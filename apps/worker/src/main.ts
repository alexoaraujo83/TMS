import { Pool } from "pg";
import { DurableJobsRepository } from "@tms/database";
import { createLogger } from "@tms/observability";
import { DurableJobProcessor } from "./durable-jobs-worker.js";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { OutboxProcessor } from "./outbox-worker.js";
import { PgOutboxStore } from "./outbox-store.js";
import { WebhookPublisher } from "./webhook-publisher.js";
import { createDurableWebhookHandler } from "./durable-job-handlers.js";
import { createFreightStatusChangedHandler } from "./freight-status-changed.handler.js";
import { normalizeDatabaseUrl } from "./database-url.js";
import { parseTenantIds, positiveIntegerEnv } from "./config.js";
import { assertConfiguredTenantsAreActive } from "./tenant-config.js";

const logger = createLogger({ service: process.env.LOG_SERVICE ?? "tms-worker" });

async function assertRuntimeRole(pool: Pool): Promise<void> {
  const result = await pool.query<{ current_user: string }>("select current_user");
  if (result.rows[0]?.current_user !== "tms_app") throw new Error("DATABASE_RUNTIME_ROLE_INVALID");
}

const databaseUrl = process.env.DATABASE_URL;
const tenantIds = parseTenantIds(process.env.OUTBOX_TENANT_IDS);
const webhookUrls = (process.env.OUTBOX_WEBHOOK_URLS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const intervalMs = positiveIntegerEnv("OUTBOX_POLL_INTERVAL_MS", 5000);
const batchSize = positiveIntegerEnv("OUTBOX_BATCH_SIZE", 50);
const webhookTimeoutMs = positiveIntegerEnv("OUTBOX_WEBHOOK_TIMEOUT_MS", 10000);
const durableJobsEnabled = process.env.DURABLE_JOBS_ENABLED === "true";

logger.log("INFO", "service.started", {}, {
  configured_tenants: tenantIds.length,
  durable_jobs_enabled: durableJobsEnabled,
  interval_ms: intervalMs,
  batch_size: batchSize,
  webhook_endpoints: webhookUrls.length,
});

if (!databaseUrl) {
  logger.log("WARN", "worker.idle", {}, { reason: "DATABASE_URL is not configured" });
} else {
  const pool = new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl) });

  const startup = async () => {
    try {
      await assertRuntimeRole(pool);
      logger.log("INFO", "database.runtime_role_verified", {}, { role: "tms_app" });

      await assertConfiguredTenantsAreActive(pool, tenantIds);
      if (tenantIds.length > 0) {
        logger.log("INFO", "worker.tenants_verified", {}, { configured_tenants: tenantIds.length });
      }

      if (tenantIds.length === 0) {
        logger.log("WARN", "worker.idle", {}, { reason: "OUTBOX_TENANT_IDS is not configured" });
        return;
      }

      const outboxStore = new PgOutboxStore(pool);
      const webhookPublisher = new WebhookPublisher(webhookUrls, {
        timeoutMs: webhookTimeoutMs,
        secret: process.env.OUTBOX_WEBHOOK_SECRET,
      });
      const durableJobRepository = new DurableJobsRepository(pool);
      const outboxProcessor = new OutboxProcessor(outboxStore, async (event) => {
        if (event.eventType === "freight.status_changed") {
          await durableJobRepository.enqueue({
            tenantId: event.tenantId,
            jobType: "freight.status_changed",
            payload: event.payload,
            idempotencyKey: event.id,
          });
          logger.log("INFO", "outbox.durable_job.enqueued", { tenantId: event.tenantId }, {
            event_id: event.id,
            event_type: event.eventType,
            job_type: "freight.status_changed",
          });
          return;
        }

        if (webhookUrls.length > 0) {
          await webhookPublisher.publish(event);
          return;
        }
        logger.log("INFO", "outbox.dispatch", {}, {
          event_id: event.id,
          event_type: event.eventType,
          tenant_id: event.tenantId,
        });
      });

      const durableJobStore = new PgDurableJobStore(pool);
      const durableJobProcessor = new DurableJobProcessor(
        durableJobStore,
        new Map([
          ["external.webhook", createDurableWebhookHandler(webhookPublisher)],
          ["freight.status_changed", createFreightStatusChangedHandler(pool, (event, details) =>
            logger.log("INFO", event, { tenantId: String(details.tenant_id) }, details),
          )],
        ]),
        { onTelemetry: (event) => logger.log("INFO", "durable_job.telemetry", {}, {
          job_id: event.jobId,
          job_type: event.jobType,
          tenant_id: event.tenantId,
          status: event.status,
          attempt: event.attempt,
          duration_ms: event.durationMs,
          error_code: event.errorCode,
        }) },
      );

      let shuttingDown = false;
      let activeRun: Promise<void> | null = null;

      const run = async () => {
        if (shuttingDown || activeRun) return;
        const execution = (async () => {
          const runStartedAt = Date.now();
          try {
            for (const tenantId of tenantIds) {
              if (shuttingDown) break;
              const outboxResult = await outboxProcessor.process(tenantId, batchSize);
              if (outboxResult.claimed > 0) {
                logger.log("INFO", "outbox.processed", { tenantId }, {
                  duration_ms: Date.now() - runStartedAt,
                  ...outboxResult,
                });
              }
              if (durableJobsEnabled && !shuttingDown) {
                const durableJobResult = await durableJobProcessor.process(tenantId, batchSize);
                if (durableJobResult.claimed > 0) {
                  logger.log("INFO", "durable_job.processed", { tenantId }, {
                    duration_ms: Date.now() - runStartedAt,
                    ...durableJobResult,
                  });
                }
              }
            }
          } catch (error) {
            logger.log("ERROR", "worker.error", {}, {
              error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
              duration_ms: Date.now() - runStartedAt,
            });
          }
        })();
        activeRun = execution;
        try { await execution; } finally { activeRun = null; }
      };

      const timer = setInterval(() => void run(), intervalMs);
      const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        clearInterval(timer);
        logger.log("INFO", "service.stopping", {}, { signal });
        if (activeRun) await activeRun;
        await pool.end();
        logger.log("INFO", "service.stopped");
      };

      process.once("SIGINT", () => void shutdown("SIGINT"));
      process.once("SIGTERM", () => void shutdown("SIGTERM"));
      await run();
    } catch (error) {
      logger.log("CRITICAL", "worker.startup_failed", {}, {
        error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
      });
      await pool.end();
      process.exitCode = 1;
    }
  };

  void startup();
}
