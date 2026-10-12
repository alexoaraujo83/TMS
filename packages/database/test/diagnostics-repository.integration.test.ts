import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { DiagnosticsRepository } from "../src/diagnostics-repository.js";

const databaseUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
const databaseAdminUrl =
  process.env.TEST_OWNER_DATABASE_URL ??
  process.env.DATABASE_ADMIN_URL ??
  process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(databaseUrl && databaseAdminUrl);

if (!enabled) {
  describe("Diagnostics repository PostgreSQL integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and database URLs are configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const adminPool = new Pool({ connectionString: databaseAdminUrl });
  const repository = new DiagnosticsRepository(pool);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const freightA = randomUUID();
  const freightB = randomUUID();
  const auditA = randomUUID();
  const auditB = randomUUID();
  const outboxA = randomUUID();
  const outboxB = randomUUID();
  const jobA = randomUUID();
  const jobB = randomUUID();
  const sharedCorrelationId = "diagnostics-shared-correlation";
  const sharedIdempotencyKey = "diagnostics-shared-idempotency-key";
  const scopedTables = ["tenants", "audit_events", "outbox_events", "durable_jobs"] as const;

  async function setRls(client: import("pg").PoolClient, enabled: boolean) {
    for (const table of scopedTables) {
      await client.query(
        `alter table ${table} ${enabled ? "enable" : "disable"} row level security`,
      );
      if (enabled) {
        await client.query(`alter table ${table} force row level security`);
      }
    }
  }

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseAdminUrl },
      stdio: "inherit",
    });
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      await setRls(client, false);
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active'), ($4, $5, $6, 'active')",
        [
          tenantA,
          "Diagnostics Integration A",
          `diagnostics-a-${tenantA}`,
          tenantB,
          "Diagnostics Integration B",
          `diagnostics-b-${tenantB}`,
        ],
      );
      await client.query(
        `insert into audit_events
          (id, tenant_id, action, entity_type, entity_id, request_id, correlation_id, outcome)
         values
          ($1, $2, 'freight.status_changed', 'freight', $3, $4, $5, 'success'),
          ($6, $7, 'freight.status_changed', 'freight', $8, $9, $5, 'success')`,
        [
          auditA,
          tenantA,
          freightA,
          `request-a-${tenantA}`,
          sharedCorrelationId,
          auditB,
          tenantB,
          freightB,
          `request-b-${tenantB}`,
        ],
      );
      await client.query(
        `insert into outbox_events
          (id, tenant_id, aggregate_type, aggregate_id, event_type, status)
         values
          ($1, $2, 'freight', $3, 'freight.status_changed', 'published'),
          ($4, $5, 'freight', $6, 'freight.status_changed', 'published')`,
        [outboxA, tenantA, freightA, outboxB, tenantB, freightB],
      );
      await client.query(
        `insert into durable_jobs
          (id, tenant_id, job_type, status, idempotency_key)
         values
          ($1, $2, 'freight.status_changed', 'completed', $3),
          ($4, $5, 'freight.status_changed', 'completed', $3)`,
        [jobA, tenantA, sharedIdempotencyKey, jobB, tenantB],
      );
      await setRls(client, true);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      await setRls(client, false);
      await client.query("delete from audit_events where tenant_id in ($1, $2)", [tenantA, tenantB]);
      await client.query("delete from outbox_events where tenant_id in ($1, $2)", [tenantA, tenantB]);
      await client.query("delete from durable_jobs where tenant_id in ($1, $2)", [tenantA, tenantB]);
      await client.query("delete from tenants where id in ($1, $2)", [tenantA, tenantB]);
      await setRls(client, true);
      await client.query("commit");
    } finally {
      client.release();
      await adminPool.end();
      await pool.end();
    }
  });

  it("runs against migration-backed audit, outbox, and durable-job columns with tenant isolation", async () => {
    const auditResultA = await repository.search(tenantA, {
      kind: "correlationId",
      value: sharedCorrelationId,
    });
    const auditResultB = await repository.search(tenantB, {
      kind: "correlationId",
      value: sharedCorrelationId,
    });
    assert.equal(auditResultA.records.length, 1);
    assert.equal(auditResultA.records[0]?.recordId, auditA);
    assert.equal(auditResultB.records.length, 1);
    assert.equal(auditResultB.records[0]?.recordId, auditB);

    const outboxResultA = await repository.search(tenantA, {
      kind: "outboxEventId",
      value: outboxA,
    });
    const outboxResultB = await repository.search(tenantB, {
      kind: "outboxEventId",
      value: outboxA,
    });
    assert.equal(outboxResultA.records[0]?.recordId, outboxA);
    assert.equal(outboxResultB.status, "no_results");
    assert.deepEqual(outboxResultB.records, []);

    const jobResultA = await repository.search(tenantA, {
      kind: "idempotencyKey",
      value: sharedIdempotencyKey,
    });
    const jobResultB = await repository.search(tenantB, {
      kind: "idempotencyKey",
      value: sharedIdempotencyKey,
    });
    assert.equal(jobResultA.records[0]?.recordId, jobA);
    assert.equal(jobResultB.records[0]?.recordId, jobB);

    const freightResultA = await repository.search(tenantA, {
      kind: "freightId",
      value: freightA,
    });
    const freightResultB = await repository.search(tenantB, {
      kind: "freightId",
      value: freightA,
    });
    assert.equal(freightResultA.records.length, 2);
    assert.equal(freightResultB.status, "no_results");
    assert.deepEqual(freightResultB.records, []);
  });
}
