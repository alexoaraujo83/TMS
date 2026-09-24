import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { DurableJobsRepository, withTenantContext } from "@tms/database";
import { createFreightStatusChangedHandler } from "./freight-status-changed.handler.js";
import type { DurableJob } from "./durable-jobs-worker.js";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { DurableJobProcessor } from "./durable-jobs-worker.js";
import { OutboxProcessor } from "./outbox-worker.js";
import { PgOutboxStore } from "./outbox-store.js";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

test(
  "proves freight.status_changed → outbox_events → durable_jobs → handler → audit/telemetry",
  { skip: !runIntegration },
  async () => {
    const adminPool = new Pool({ connectionString: adminDatabaseUrl });
    const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
    const tenantId = randomUUID();
    const freightId = randomUUID();
    const eventId = randomUUID();
    const telemetry: Array<{ event: string; details: Record<string, unknown> }> = [];

    try {
      await adminPool.query(
        "insert into tenants (id, name, slug, status) values ($1, 'Worker Flow Tenant', $2, 'active')",
        [tenantId, `worker-flow-${tenantId}`],
      );
      await adminPool.query(
        `insert into freights (
           id, tenant_id, status, freight_type, origin_city, origin_state,
           destination_city, destination_state, cargo_description, quantity, weight_kg
         ) values ($1, $2, 'in_transit', 'dedicated', 'Santos', 'SP', 'Campinas', 'SP', 'worker flow', 1, 100)`,
        [freightId, tenantId],
      );
      await adminPool.query(
        `insert into outbox_events (
           id, tenant_id, aggregate_type, aggregate_id, event_type, payload
         ) values ($1, $2, 'freight', $3, 'freight.status_changed', $4::jsonb)`,
        [
          eventId,
          tenantId,
          freightId,
          JSON.stringify({
            event_id: eventId,
            freight_id: freightId,
            from_status: "assigned",
            to_status: "in_transit",
          }),
        ],
      );

      const durableJobs = new DurableJobsRepository(runtimePool);
      const outbox = new OutboxProcessor(
        new PgOutboxStore(runtimePool),
        async (event) => {
          assert.equal(event.eventType, "freight.status_changed");
          await durableJobs.enqueue({
            tenantId: event.tenantId,
            jobType: "freight.status_changed",
            payload: event.payload,
            idempotencyKey: event.id,
          });
        },
      );

      const outboxResult = await outbox.process(tenantId, 10);
      assert.deepEqual(outboxResult, { claimed: 1, published: 1, failed: 0 });

      const handler = createFreightStatusChangedHandler(
        runtimePool,
        (event, details) => telemetry.push({ event, details }),
      );
      const durable = new DurableJobProcessor(
        new PgDurableJobStore(runtimePool),
        new Map([["freight.status_changed", handler]]),
      );

      const jobResult = await durable.process(tenantId, 10);
      assert.deepEqual(jobResult, { claimed: 1, completed: 1, failed: 0 });

      const replayJob: DurableJob = {
        id: randomUUID(),
        tenantId,
        jobType: "freight.status_changed",
        payload: {
          event_id: eventId,
          freight_id: freightId,
          from_status: "assigned",
          to_status: "in_transit",
        },
        status: "completed",
        attempts: 1,
        maxAttempts: 5,
        availableAt: new Date(),
        leaseToken: null,
        lastError: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await handler(replayJob);

      const state = await withTenantContext(runtimePool, tenantId, async (client) => {
        const outboxRow = await client.query(
          "select status from outbox_events where id = $1",
          [eventId],
        );
        const jobRow = await client.query(
          "select status, attempts from durable_jobs where tenant_id = $1 and job_type = 'freight.status_changed' and idempotency_key = $2",
          [tenantId, eventId],
        );
        const auditRow = await client.query(
          "select action, outcome, metadata->>'event_id' as event_id from audit_events where tenant_id = $1 and action = 'freight.status_changed.processed' and metadata->>'event_id' = $2",
          [tenantId, eventId],
        );
        return {
          outbox: outboxRow.rows[0],
          job: jobRow.rows[0],
          audit: auditRow.rows[0],
          auditCount: auditRow.rowCount,
        };
      });

      assert.equal(state.outbox?.status, "published");
      assert.equal(state.job?.status, "completed");
      assert.equal(Number(state.job?.attempts), 1);
      assert.equal(state.audit?.action, "freight.status_changed.processed");
      assert.equal(state.audit?.outcome, "success");
      assert.equal(state.audit?.event_id, eventId);
      assert.equal(state.auditCount, 1);
      assert.equal(telemetry[0]?.event, "freight.status_changed.handled");
      assert.equal(telemetry[0]?.details.event_id, eventId);
      assert.equal(telemetry[0]?.details.idempotent_replay, false);
      assert.equal(telemetry[1]?.event, "freight.status_changed.handled");
      assert.equal(telemetry[1]?.details.event_id, eventId);
      assert.equal(telemetry[1]?.details.idempotent_replay, true);
    } finally {
      await adminPool.query("delete from audit_events where tenant_id = $1", [tenantId]);
      await adminPool.query("delete from outbox_events where tenant_id = $1", [tenantId]);
      await adminPool.query("delete from durable_jobs where tenant_id = $1", [tenantId]);
      await adminPool.query("delete from freights where tenant_id = $1", [tenantId]);
      await adminPool.query("delete from tenants where id = $1", [tenantId]);
      await runtimePool.end();
      await adminPool.end();
    }
  },
);
