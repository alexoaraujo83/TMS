import { Pool } from "pg";
import { DurableJobProcessor } from "./durable-jobs-worker.js";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { OutboxProcessor } from "./outbox-worker.js";
import { PgOutboxStore } from "./outbox-store.js";

const databaseUrl = process.env.DATABASE_URL;
const tenantIds = (process.env.OUTBOX_TENANT_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const intervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.OUTBOX_BATCH_SIZE ?? 50);
const durableJobsEnabled = process.env.DURABLE_JOBS_ENABLED === "true";

const startedAt = new Date().toISOString();
console.log(
  JSON.stringify({
    service: "tms-worker",
    status: "started",
    startedAt,
    configuredTenants: tenantIds.length,
    durableJobsEnabled,
  }),
);

if (!databaseUrl || tenantIds.length === 0) {
  console.log(
    JSON.stringify({
      service: "tms-worker",
      status: "idle",
      reason: "DATABASE_URL or OUTBOX_TENANT_IDS is not configured",
    }),
  );
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const outboxStore = new PgOutboxStore(pool);
  const outboxProcessor = new OutboxProcessor(outboxStore, async (event) => {
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
  );

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const tenantId of tenantIds) {
        const outboxResult = await outboxProcessor.process(tenantId, batchSize);
        if (outboxResult.claimed > 0) {
          console.log(
            JSON.stringify({
              event: "outbox.processed",
              tenantId,
              ...outboxResult,
            }),
          );
        }

        if (durableJobsEnabled) {
          const durableJobResult = await durableJobProcessor.process(
            tenantId,
            batchSize,
          );
          if (durableJobResult.claimed > 0) {
            console.log(
              JSON.stringify({
                event: "durable_job.processed",
                tenantId,
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
        }),
      );
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => void run(), intervalMs);
}
