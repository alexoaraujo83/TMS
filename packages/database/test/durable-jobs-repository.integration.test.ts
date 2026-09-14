import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { DurableJobsRepository } from "../src/durable-jobs-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("Durable jobs repository integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const jobs = new DurableJobsRepository(pool);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("alter table durable_jobs disable row level security");
      await client.query("alter table tenants disable row level security");
      for (const [id, suffix] of [
        [tenantId, "jobs-a"],
        [otherTenantId, "jobs-b"],
      ]) {
        await client.query(
          "insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')",
          [id, `Durable Jobs Test ${suffix}`, `${suffix}-${id}`],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("alter table durable_jobs disable row level security");
      await client.query("alter table tenants disable row level security");
      await client.query(
        "delete from durable_jobs where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query("delete from tenants where id in ($1, $2)", [
        tenantId,
        otherTenantId,
      ]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("enqueues and claims a job with a lease", async () => {
    const job = await jobs.enqueue({
      tenantId,
      jobType: "integration.test",
      payload: { source: "integration-test" },
    });
    assert.equal(job.status, "pending");
    assert.equal(job.attempts, 0);
    const claimed = await jobs.claimPending(tenantId, 10);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].id, job.id);
    assert.equal(claimed[0].status, "running");
    assert.equal(claimed[0].attempts, 1);
    assert.ok(claimed[0].leaseToken);
  });

  it("completes only with the active lease", async () => {
    const job = await jobs.enqueue({
      tenantId,
      jobType: "integration.complete",
    });
    const [claimed] = await jobs.claimPending(tenantId, 1);
    await assert.rejects(
      jobs.complete(tenantId, job.id, randomUUID()),
      /DURABLE_JOB_NOT_COMPLETABLE/,
    );
    const completed = await jobs.complete(
      tenantId,
      job.id,
      claimed.leaseToken,
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.leaseToken, null);
    assert.ok(completed.completedAt);
  });

  it("retries below max attempts and fails at exhaustion", async () => {
    const job = await jobs.enqueue({
      tenantId,
      jobType: "integration.retry",
      maxAttempts: 2,
    });
    const [first] = await jobs.claimPending(tenantId, 1);
    const retried = await jobs.fail(
      tenantId,
      job.id,
      first.leaseToken,
      "temporary failure",
      new Date(),
    );
    assert.equal(retried.status, "pending");
    const [second] = await jobs.claimPending(tenantId, 1);
    const failed = await jobs.fail(
      tenantId,
      job.id,
      second.leaseToken,
      "permanent failure",
    );
    assert.equal(failed.status, "failed");
    assert.equal(failed.attempts, 2);
  });

  it("keeps tenant jobs isolated", async () => {
    await jobs.enqueue({ tenantId, jobType: "integration.isolated" });
    const claimed = await jobs.claimPending(otherTenantId, 10);
    assert.equal(claimed.length, 0);
  });

  it("rejects stale lease completion after reclaim", async () => {
    const job = await jobs.enqueue({
      tenantId,
      jobType: "integration.stale",
    });
    const [first] = await jobs.claimPending(tenantId, 1);
    const client = await pool.connect();
    try {
      await client.query(
        "update durable_jobs set available_at = now() where id = $1",
        [job.id],
      );
    } finally {
      client.release();
    }
    const [second] = await jobs.claimPending(tenantId, 1);
    assert.notEqual(first.leaseToken, second.leaseToken);
    await assert.rejects(
      jobs.complete(tenantId, job.id, first.leaseToken),
      /DURABLE_JOB_NOT_COMPLETABLE/,
    );
    const completed = await jobs.complete(
      tenantId,
      job.id,
      second.leaseToken,
    );
    assert.equal(completed.status, "completed");
  });
}
