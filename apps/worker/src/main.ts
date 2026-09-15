import { Pool } from "pg";
import { DurableJobProcessor } from "./durable-jobs-worker.js";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { OutboxProcessor } from "./outbox-worker.js";
import { PgOutboxStore } from "./outbox-store.js";
import { WebhookPublisher } from "./webhook-publisher.js";

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_WORKER_CONFIG:${name}`);
  }

  return value;
}

export function normalizeDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

async function assertRuntimeRole(pool: Pool): Promise<void> {
  const result = await pool.query<{ current_user: string }>(
    "select current_user",
  );

  if (result.rows[0]?.current_user !== "tms_app") {
    throw new Error("DATABASE_RUNTIME_ROLE_INVALID");
  }
}

const databaseUrl = process.env.DATABASE_URL;
const tenantIds = (process.env.OUTBOX_TENANT_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const webhookUrls = (process.env.OUTBOX_WEBHOOK_URLS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const intervalMs = positiveIntegerEnv("OUTBOX_POLL_INTERVAL_MS", 5000);
const batchSize = positiveIntegerEnv("OUTBOX_BATCH_SIZE", 50);
const webhookTimeoutMs = positiveIntegerEnv("OUTBOX_WEBHOOK_TIMEOUT_MS", 10000);
const durableJobsEnabled = process.env.DURABLE_JOBS_ENABLED === "true";

const startedAt = new Date().toISOString();
console.log(
  JSON.stringify({
    service: "tms-worker",
    status: "started",
    startedAt,
    configuredTenants: tenantIds.length,
    durableJobsEnabled,
    intervalMs,
    batchSize,
    webhookEndpoints: webhookUrls.length,
  }),
);

if (!databaseUrl) {
  console.log(
    JSON.stringify({
      service: "tms-worker",
      status: "idle",
      reason: "DATABASE_URL is not configured",
    }),
  );
} else {
  const pool = new Pool({ connectionString: normalizeDatabaseUrl(databaseUrl) });

  const startup = async () => {
    try {
      await assertRuntimeRole(pool);
      console.log(
        JSON.stringify({
          service: "tms-worker",
          event: "database.runtime_role_verified",
          role: "tms_app",
        }),
      );

      if (tenantIds.length === 0) {
        console.log(
          JSON.stringify({
            service: "tms-worker",
            status: "idle",
            reason: "OUTBOX_TENANT_IDS is not configured",
          }),
        );
        return;
      }

      const outboxStore = new PgOutboxStore(pool);
      const webhookPublisher = new WebhookPublisher(webhookUrls, {
        timeoutMs: webhookTimeoutMs,
        secret: process.env.OUTBOX_WEBHOOK_SECRET,
      });
      const outboxProcessor = new OutboxProcessor(outboxStore, async (event) => {
        if (webhookUrls.length > 0) {
          await webhookPublisher.publish(event);
          return;
        }

        console.log(
          JSON.stringify({
            event: "outbox.dispatch",
            eventId: event.id,
            eventType: event.eventType,
            tenantId: event.tenantId,
          }),
        );
      });

      const durableJobStore = new PgDurableJobStore(pool);
      const durableJobProcessor = new DurableJobProcessor(
        durableJobStore,
        new Map([
          [
            "system.noop",
            async (job) => {
              console.log(
                JSON.stringify({
                  event: "durable_job.execute",
                  jobId: job.id,
                  jobType: job.jobType,
                  tenantId: job.tenantId,
                }),
              );
            },
          ],
        ]),
        {
          onTelemetry: (event) => console.log(JSON.stringify(event)),
        },
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

              const outboxResult = await outboxProcessor.process(
                tenantId,
                batchSize,
              );
              if (outboxResult.claimed > 0) {
                console.log(
                  JSON.stringify({
                    event: "outbox.processed",
                    tenantId,
                    durationMs: Date.now() - runStartedAt,
                    ...outboxResult,
                  }),
                );
              }

              if (durableJobsEnabled && !shuttingDown) {
                const durableJobResult = await durableJobProcessor.process(
                  tenantId,
                  batchSize,
                );
                if (durableJobResult.claimed > 0) {
                  console.log(
                    JSON.stringify({
                      event: "durable_job.processed",
                      tenantId,
                      durationMs: Date.now() - runStartedAt,
                      ...durableJobResult,
                    }),
                  );
                }
              }
            }
          } catch (error) {
            console.error(
              JSON.stringify({
                event: "worker.error",
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - runStartedAt,
              }),
            );
          }
        })();

        activeRun = execution;
        try {
          await execution;
        } finally {
          activeRun = null;
        }
      };

      const timer = setInterval(() => void run(), intervalMs);

      const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        clearInterval(timer);

        console.log(
          JSON.stringify({
            service: "tms-worker",
            status: "stopping",
            signal,
          }),
        );

        if (activeRun) {
          await activeRun;
        }

        await pool.end();

        console.log(
          JSON.stringify({
            service: "tms-worker",
            status: "stopped",
          }),
        );
      };

      process.once("SIGINT", () => void shutdown("SIGINT"));
      process.once("SIGTERM", () => void shutdown("SIGTERM"));

      await run();
    } catch (error) {
      console.error(
        JSON.stringify({
          service: "tms-worker",
          event: "worker.startup_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await pool.end();
      process.exitCode = 1;
    }
  };

  void startup();
}
