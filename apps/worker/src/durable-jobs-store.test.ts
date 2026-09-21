import assert from "node:assert/strict";
import test from "node:test";
import { PgDurableJobStore } from "./durable-jobs-store.js";

function createPool(queryResult: { rows: Record<string, unknown>[] }) {
  const queries: string[] = [];
  const values: unknown[][] = [];
  const client = {
    query: async (text: string, params?: unknown[]) => {
      queries.push(text); values.push(params ?? []);
      if (/^select set_config/.test(text)) return { rows: [] };
      if (/^begin|^commit|^rollback/.test(text)) return { rows: [] };
      return queryResult;
    },
    release: () => undefined,
  };
  return { pool: { connect: async () => client } as never, queries, values };
}

test("claimPending excludes jobs that already exhausted attempts", async () => {
  const { pool, queries } = createPool({ rows: [] }); const store = new PgDurableJobStore(pool);
  const jobs = await store.claimPending("00000000-0000-0000-0000-000000000001", 50);
  assert.deepEqual(jobs, []); assert.ok(queries.some((query) => /jobs\.attempts < jobs\.max_attempts/.test(query)));
});

test("claimPending can reclaim an expired running lease", async () => {
  const row = { id: "job-1", tenant_id: "00000000-0000-0000-0000-000000000001", job_type: "test.job", payload: {}, status: "running", attempts: 2, max_attempts: 5, available_at: new Date(), lease_token: "new-lease", last_error: null, completed_at: null, created_at: new Date(), updated_at: new Date() };
  const { pool, queries } = createPool({ rows: [row] }); const store = new PgDurableJobStore(pool);
  const jobs = await store.claimPending("00000000-0000-0000-0000-000000000001", 1);
  assert.equal(jobs[0]?.status, "running"); assert.equal(jobs[0]?.leaseToken, "new-lease");
  assert.ok(queries.some((query) => /status in \('pending', 'running'\)/.test(query) && /available_at <= now\(\)/.test(query) && /status = 'active'/.test(query) && /for update skip locked/i.test(query)));
});

test("renewLease rejects a non-positive or non-finite lease duration", async () => {
  const { pool, queries } = createPool({ rows: [] }); const store = new PgDurableJobStore(pool);
  await assert.rejects(() => store.renewLease("tenant", "job", "lease", 0), { message: "DURABLE_JOB_LEASE_INVALID" });
  await assert.rejects(() => store.renewLease("tenant", "job", "lease", -1), { message: "DURABLE_JOB_LEASE_INVALID" });
  await assert.rejects(() => store.renewLease("tenant", "job", "lease", Number.NaN), { message: "DURABLE_JOB_LEASE_INVALID" });
  assert.equal(queries.length, 0);
});

test("renewLease requires the current lease token and extends availability", async () => {
  const row = { id: "job-1", tenant_id: "00000000-0000-0000-0000-000000000001", job_type: "test.job", payload: {}, status: "running", attempts: 2, max_attempts: 5, available_at: new Date(), lease_token: "lease-1", last_error: null, completed_at: null, created_at: new Date(), updated_at: new Date() };
  const { pool, queries, values } = createPool({ rows: [row] }); const store = new PgDurableJobStore(pool);
  await store.renewLease("00000000-0000-0000-0000-000000000001", "job-1", "lease-1", 300_000);
  const updateIndex = queries.findIndex((query) => /^update durable_jobs/.test(query));
  assert.ok(updateIndex >= 0); assert.match(queries[updateIndex] ?? "", /available_at = now\(\) \+ \(\$4 \* interval/); assert.match(queries[updateIndex] ?? "", /status = 'running'/); assert.match(queries[updateIndex] ?? "", /lease_token = \$3/);
  assert.deepEqual(values[updateIndex], ["00000000-0000-0000-0000-000000000001", "job-1", "lease-1", 300_000]);
});

test("stale lease cannot finalize a reclaimed job", async () => {
  const { pool } = createPool({ rows: [] }); const store = new PgDurableJobStore(pool);
  await assert.rejects(() => store.complete("00000000-0000-0000-0000-000000000001", "job-1", "stale-lease"), { message: "DURABLE_JOB_NOT_COMPLETABLE" });
  await assert.rejects(() => store.fail("00000000-0000-0000-0000-000000000001", "job-1", "stale-lease", "boom", new Date()), { message: "DURABLE_JOB_NOT_FAILABLE" });
});

test("complete requires the current lease token", async () => {
  const row = { id: "job-1", tenant_id: "00000000-0000-0000-0000-000000000001", job_type: "test.job", payload: {}, status: "completed", attempts: 1, max_attempts: 5, available_at: new Date(), lease_token: null, last_error: null, completed_at: new Date(), created_at: new Date(), updated_at: new Date() };
  const { pool, queries, values } = createPool({ rows: [row] }); const store = new PgDurableJobStore(pool);
  await store.complete("00000000-0000-0000-0000-000000000001", "job-1", "lease-1");
  const updateIndex = queries.findIndex((query) => /^update durable_jobs/.test(query));
  assert.ok(updateIndex >= 0); assert.match(queries[updateIndex] ?? "", /status = 'running'/); assert.match(queries[updateIndex] ?? "", /lease_token = \$3/);
  assert.deepEqual(values[updateIndex], ["00000000-0000-0000-0000-000000000001", "job-1", "lease-1"]);
});
