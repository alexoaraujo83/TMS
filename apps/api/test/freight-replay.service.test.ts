import assert from "node:assert/strict";
import test from "node:test";
import { FreightService } from "../src/modules/freight/freight.service.ts";

const TENANT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const FREIGHT_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const JOB_ID = "44444444-4444-4444-8444-444444444444";

function context() {
  return {
    requestId: "req-replay-test",
    correlationId: "corr-replay-test",
    userId: USER_ID,
    tenantId: TENANT_ID,
    roles: ["admin"],
    permissions: ["freight:replay"],
  };
}

function poolFor(queries: Array<unknown>) {
  const calls: Array<{ sql: string; params?: readonly unknown[] }> = [];
  const client = {
    query: async (sql: string, params?: readonly unknown[]) => {
      calls.push({ sql, params });
      const next = queries.shift();
      if (typeof next === "function") return next(sql, params);
      return next ?? { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  };
  return { connect: async () => client, calls } as never;
}

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    tenant_id: TENANT_ID,
    aggregate_id: FREIGHT_ID,
    event_type: "freight.status_changed",
    payload: {
      event_id: EVENT_ID,
      freight_id: FREIGHT_ID,
      from_status: "draft",
      to_status: "posted",
    },
    ...overrides,
  };
}

test("replay enqueues a durable job and audit event in one tenant transaction", async () => {
  const pool = poolFor([
    { rows: [] },
    { rows: [] },
    { rows: [validEvent()] },
    { rows: [{ id: JOB_ID, status: "pending" }] },
    { rows: [] },
  ]);
  const service = new FreightService(pool);

  const result = await service.replayStatusChangedEvent(
    context(),
    FREIGHT_ID,
    EVENT_ID,
  );

  assert.equal(result.eventId, EVENT_ID);
  assert.equal(result.durableJobId, JOB_ID);
  assert.match(result.idempotencyKey, new RegExp(`^replay:${EVENT_ID}:`));
  assert.equal(result.status, "pending");
  assert.match(pool.calls[2]?.sql ?? "", /from outbox_events/);
  assert.match(pool.calls[3]?.sql ?? "", /insert into durable_jobs/);
  assert.match(pool.calls[4]?.sql ?? "", /insert into audit_events/);
  assert.match(pool.calls[4]?.sql ?? "", /durable_job\.replay_requested/);
  assert.equal(pool.calls.at(-1)?.sql, "commit");
});

test("replay rejects an event that does not belong to the requested freight", async () => {
  const pool = poolFor([
    { rows: [] },
    { rows: [] },
    { rows: [validEvent({ aggregate_id: "55555555-5555-4555-8555-555555555555" })] },
  ]);
  const service = new FreightService(pool);

  await assert.rejects(
    service.replayStatusChangedEvent(context(), FREIGHT_ID, EVENT_ID),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Freight status-change event not found",
  );
  assert.equal(pool.calls.at(-1)?.sql, "rollback");
});

test("replay rejects an event with inconsistent payload identifiers", async () => {
  const pool = poolFor([
    { rows: [] },
    { rows: [] },
    {
      rows: [
        validEvent({
          payload: {
            event_id: EVENT_ID,
            freight_id: "66666666-6666-4666-8666-666666666666",
          },
        }),
      ],
    },
  ]);
  const service = new FreightService(pool);

  await assert.rejects(
    service.replayStatusChangedEvent(context(), FREIGHT_ID, EVENT_ID),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        "Freight status-change event payload is inconsistent",
  );
  assert.equal(pool.calls.at(-1)?.sql, "rollback");
});

test("replay keeps repeated requests distinct by design", async () => {
  const makeService = () =>
    new FreightService(
      poolFor([
        { rows: [] },
        { rows: [] },
        { rows: [validEvent()] },
        { rows: [{ id: JOB_ID, status: "pending" }] },
        { rows: [] },
      ]),
    );

  const first = await makeService().replayStatusChangedEvent(
    context(),
    FREIGHT_ID,
    EVENT_ID,
  );
  const second = await makeService().replayStatusChangedEvent(
    context(),
    FREIGHT_ID,
    EVENT_ID,
  );

  assert.notEqual(first.idempotencyKey, second.idempotencyKey);
});
