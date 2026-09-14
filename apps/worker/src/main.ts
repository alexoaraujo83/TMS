import { Pool } from "pg";
import { OutboxProcessor } from "./outbox-worker.js";
import { PgOutboxStore } from "./outbox-store.js";

const databaseUrl = process.env.DATABASE_URL;
const tenantIds = (process.env.OUTBOX_TENANT_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const intervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.OUTBOX_BATCH_SIZE ?? 50);

const startedAt = new Date().toISOString();
console.log(
  JSON.stringify({
    service: "tms-worker",
    status: "started",
    startedAt,
    configuredTenants: tenantIds.length,
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
  const store = new PgOutboxStore(pool);
  const processor = new OutboxProcessor(store, async (event) => {
    console.log(
      JSON.stringify({
        event: "outbox.dispatch",
        eventId: event.id,
        eventType: event.eventType,
        tenantId: event.tenantId,
      }),
    );
  });

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      for (const tenantId of tenantIds) {
        const result = await processor.process(tenantId, batchSize);
        if (result.claimed > 0) {
          console.log(
            JSON.stringify({ event: "outbox.processed", tenantId, ...result }),
          );
        }
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "outbox.worker_error",
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
