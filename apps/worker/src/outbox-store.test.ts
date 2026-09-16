import assert from "node:assert/strict";
import test from "node:test";
import { PgOutboxStore } from "./outbox-store.js";

function createPool(rows: Record<string, unknown>[]) {
  const queries: string[] = [];
  const values: unknown[][] = [];
  const client = {
    query: async (text: string, params?: unknown[]) => {
      queries.push(text);
      values.push(params ?? []);
      if (/^begin|^commit|^rollback|^select set_config/.test(text)) {
        return { rows: [] };
      }
      return { rows };
    },
    release: () => undefined,
  };
  return {
    pool: { connect: async () => client } as never,
    queries,
    values,
  };
}

test("claimPending uses tenant context and row locking for concurrent workers", async () => {
  const row = {
    id: "event-1",
    tenant_id: "tenant-1",
    aggregate_type: "freight",
    aggregate_id: "freight-1",
    event_type: "freight.created",
    payload: { id: "freight-1" },
    attempts: 1,
    lease_token: "lease-1",
  };
  const { pool, queries, values } = createPool([row]);
  const store = new PgOutboxStore(pool);

  const events = await store.claimPending("tenant-1", 10);

  assert.equal(events[0]?.tenantId, "tenant-1");
  assert.equal(events[0]?.leaseToken, "lease-1");
  assert.ok(queries.some((query) => /for update skip locked/i.test(query)));
  assert.ok(queries.some((query) => /status = 'pending'/.test(query)));
  assert.ok(queries.some((query) => /status = 'active'/.test(query)));
  assert.deepEqual(values[1], ["app.tenant_id", "tenant-1"]);
});

test("renewLease extends only the current fenced pending event", async () => {
  const { pool, queries, values } = createPool([{ id: "event-1" }]);
  const store = new PgOutboxStore(pool);

  await store.renewLease("tenant-1", "event-1", "lease-1", 300000);

  const updateIndex = queries.findIndex((query) => /^update outbox_events/.test(query));
  assert.ok(updateIndex >= 0);
  assert.match(queries[updateIndex] ?? "", /available_at = now\(\) \+ \(\$4 \* interval '1 millisecond'\)/);
  assert.match(queries[updateIndex] ?? "", /status = 'pending'/);
  assert.match(queries[updateIndex] ?? "", /lease_token = \$3/);
  assert.deepEqual(values[updateIndex], ["tenant-1", "event-1", "lease-1", 300000]);
});

test("renewLease rejects an invalid lease duration before database access", async () => {
  const { pool, queries } = createPool([]);
  const store = new PgOutboxStore(pool);

  await assert.rejects(
    store.renewLease("tenant-1", "event-1", "lease-1", 0),
    /OUTBOX_LEASE_INVALID/,
  );
  assert.equal(queries.length, 0);
});

test("markPublished requires the claimed lease token", async () => {
  const { pool, queries, values } = createPool([{ id: "event-1" }]);
  const store = new PgOutboxStore(pool);

  await store.markPublished("tenant-1", "event-1", "lease-1");

  const updateIndex = queries.findIndex((query) => /^update outbox_events/.test(query));
  assert.ok(updateIndex >= 0);
  assert.match(queries[updateIndex] ?? "", /status = 'pending'/);
  assert.match(queries[updateIndex] ?? "", /lease_token = \$3/);
  assert.deepEqual(values[updateIndex], ["tenant-1", "event-1", "lease-1"]);
});

test("markFailed makes the fifth attempt terminal", async () => {
  const { pool, queries, values } = createPool([{ id: "event-1" }]);
  const store = new PgOutboxStore(pool);
  const retryAt = new Date("2026-09-15T22:00:00.000Z");

  await store.markFailed(
    "tenant-1",
    "event-1",
    "lease-1",
    "broker unavailable",
    retryAt,
  );

  const updateIndex = queries.findIndex((query) => /^update outbox_events/.test(query));
  assert.ok(updateIndex >= 0);
  assert.match(queries[updateIndex] ?? "", /attempts >= 5/);
  assert.deepEqual(values[updateIndex], [
    "tenant-1",
    "event-1",
    "broker unavailable",
    retryAt,
    "lease-1",
  ]);
});
