import assert from "node:assert/strict";
import test from "node:test";
import { createFreightStatusChangedHandler } from "./freight-status-changed.handler.js";

function createPool() {
  const queries: string[] = [];
  let auditExists = false;
  const client = {
    async query(sql: string) {
      queries.push(sql);
      if (/select status from freights/i.test(sql)) {
        return { rows: [{ status: "in_transit" }] };
      }
      if (/select exists/i.test(sql)) {
        return { rows: [{ exists: auditExists }] };
      }
      if (/insert into audit_events/i.test(sql)) {
        auditExists = true;
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    queries,
    getClient() { return client; },
    async connect() { return client; },
  } as any;
}

test("handles freight.status_changed and is idempotent on replay", async () => {
  const pool = createPool();
  const events: Array<{ event: string; details: Record<string, unknown> }> = [];
  const handler = createFreightStatusChangedHandler(pool, (event, details) => {
    events.push({ event, details });
  });

  const job = {
    id: "job-1",
    tenantId: "00000000-0000-0000-0000-000000000001",
    jobType: "freight.status_changed",
    payload: {
      event_id: "event-1",
      freight_id: "00000000-0000-0000-0000-000000000002",
      from_status: "assigned",
      to_status: "in_transit",
    },
    status: "running",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    leaseToken: "lease-1",
    lastError: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  await handler(job);
  await handler(job);

  assert.equal(events.length, 2);
  assert.equal(events[0]?.event, "freight.status_changed.handled");
  assert.equal(events[0]?.details.idempotent_replay, false);
  assert.equal(events[1]?.details.idempotent_replay, true);
  assert.equal(pool.queries.filter((sql: string) => /insert into audit_events/i.test(sql)).length, 1);
});
