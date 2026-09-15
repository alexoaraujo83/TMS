import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { PgDurableJobStore } from "./durable-jobs-store.js";
import { PgOutboxStore } from "./outbox-store.js";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

const describeIntegration = runIntegration ? test : test;

describeIntegration(
  "worker PostgreSQL concurrency integration",
  { skip: !runIntegration },
  async () => {
    const adminPool = new Pool({ connectionString: adminDatabaseUrl });
    const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const outboxIds = [randomUUID(), randomUUID()];
    const durableJobId = randomUUID();

    try {
      await provisionFixtures(adminPool, tenantA, tenantB, outboxIds, durableJobId);

      await testOutboxConcurrency(runtimePool, tenantA, outboxIds);
      await testOutboxCrossTenantIsolation(runtimePool, tenantA, tenantB);
      await testDurableJobConcurrency(runtimePool, tenantA, durableJobId);
      await testDurableJobLeaseOwnership(runtimePool, tenantA, durableJobId);
    } finally {
      await cleanupFixtures(adminPool, tenantA, tenantB);
      await runtimePool.end();
      await adminPool.end();
    }
  },
);

async function provisionFixtures(
  pool: Pool,
  tenantA: string,
  tenantB: string,
  outboxIds: string[],
  durableJobId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("alter table outbox_events disable row level security");
    await client.query("alter table durable_jobs disable row level security");
    await client.query("alter table tenants disable row level security");

    await client.query(
      `insert into tenants (id, name, slug, status)
       values ($1, 'Worker Tenant A', $1, 'active'), ($2, 'Worker Tenant B', $2, 'active')`,
      [tenantA, tenantB],
    );
    await client.query(
      `insert into outbox_events
       (id, tenant_id, aggregate_type, aggregate_id, event_type, payload, status, attempts, available_at, created_at, updated_at)
       values
       ($1, $3, 'freight', $1, 'freight.created', '{"tenant":"a"}', 'pending', 0, now(), now(), now()),
       ($2, $3, 'freight', $2, 'freight.updated', '{"tenant":"a"}', 'pending', 0, now(), now(), now())`,
      [outboxIds[0], outboxIds[1], tenantA],
    );
    await client.query(
      `insert into durable_jobs
       (id, tenant_id, job_type, payload, status, attempts, max_attempts, available_at, created_at, updated_at)
       values ($1, $2, 'system.noop', '{"tenant":"a"}', 'pending', 0, 3, now(), now(), now())`,
      [durableJobId, tenantA],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await enableRls(pool);
  }
}

async function enableRls(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("alter table outbox_events enable row level security");
    await client.query("alter table outbox_events force row level security");
    await client.query("alter table durable_jobs enable row level security");
    await client.query("alter table durable_jobs force row level security");
    await client.query("alter table tenants enable row level security");
    await client.query("alter table tenants force row level security");
  } finally {
    client.release();
  }
}

async function testOutboxConcurrency(
  pool: Pool,
  tenantId: string,
  ids: string[],
): Promise<void> {
  const storeA = new PgOutboxStore(pool);
  const storeB = new PgOutboxStore(pool);
  const [claimedA, claimedB] = await Promise.all([
    storeA.claimPending(tenantId, 1),
    storeB.claimPending(tenantId, 1),
  ]);

  assert.equal(claimedA.length, 1);
  assert.equal(claimedB.length, 1);
  assert.notEqual(claimedA[0]?.id, claimedB[0]?.id);
  assert.deepEqual(
    new Set([claimedA[0]?.id, claimedB[0]?.id]),
    new Set(ids),
  );
}

async function testOutboxCrossTenantIsolation(
  pool: Pool,
  tenantA: string,
  tenantB: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config($1, $2, true)", [
      "app.tenant_id",
      tenantB,
    ]);
    const result = await client.query(
      "select count(*)::int as count from outbox_events where tenant_id = $1",
      [tenantA],
    );
    await client.query("rollback");
    assert.equal(result.rows[0]?.count, 0);
  } finally {
    client.release();
  }
}

async function testDurableJobConcurrency(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<void> {
  const storeA = new PgDurableJobStore(pool);
  const storeB = new PgDurableJobStore(pool);
  const [claimedA, claimedB] = await Promise.all([
    storeA.claimPending(tenantId, 1),
    storeB.claimPending(tenantId, 1),
  ]);

  assert.equal(claimedA.length + claimedB.length, 1);
  const claimed = claimedA[0] ?? claimedB[0];
  assert.equal(claimed?.id, id);
  assert.equal(claimed?.status, "running");
}

async function testDurableJobLeaseOwnership(
  pool: Pool,
  tenantId: string,
  id: string,
): Promise<void> {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const adminClient = await adminPool.connect();
  try {
    await adminClient.query("alter table durable_jobs disable row level security");
    await adminClient.query(
      "update durable_jobs set available_at = now() - interval '1 minute', status = 'running' where id = $1",
      [id],
    );
    await adminClient.query("alter table durable_jobs enable row level security");
    await adminClient.query("alter table durable_jobs force row level security");
  } finally {
    adminClient.release();
    await adminPool.end();
  }

  const first = new PgDurableJobStore(pool);
  const firstClaim = await first.claimPending(tenantId, 1);
  assert.equal(firstClaim.length, 1);
  const oldLease = firstClaim[0]!.leaseToken!;

  const second = new PgDurableJobStore(pool);
  const secondClaim = await second.claimPending(tenantId, 1);
  assert.equal(secondClaim.length, 1);
  const newLease = secondClaim[0]!.leaseToken!;
  assert.notEqual(oldLease, newLease);

  await assert.rejects(
    first.complete(tenantId, id, oldLease),
    /DURABLE_JOB_NOT_COMPLETABLE/,
  );
  await second.complete(tenantId, id, newLease);
}

async function cleanupFixtures(
  pool: Pool,
  tenantA: string,
  tenantB: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const table of ["outbox_events", "durable_jobs", "tenants"]) {
      await client.query(`alter table ${table} disable row level security`);
    }
    await client.query("delete from outbox_events where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from durable_jobs where tenant_id in ($1, $2)", [
      tenantA,
      tenantB,
    ]);
    await client.query("delete from tenants where id in ($1, $2)", [tenantA, tenantB]);
    await client.query("commit");
  } finally {
    client.release();
    await enableRls(pool);
  }
}
