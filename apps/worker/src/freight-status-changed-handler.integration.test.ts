import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { Pool } from "pg";
import { createFreightStatusChangedHandler } from "./freight-status-changed-handler.js";
import type { DurableJob } from "./durable-jobs-worker.js";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

if (!runIntegration) {
  test("freight Durable Job integration is disabled without CI database configuration", () => {});
} else {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
  const tenantId = randomUUID();
  const freightId = randomUUID();
  const jobId = randomUUID();

  const durableJob: DurableJob = {
    id: jobId,
    tenantId,
    jobType: "freight.status.changed",
    payload: {
      freightId,
      expectedStatus: "draft",
      nextStatus: "open",
      eventId: randomUUID(),
    },
    status: "running",
    attempts: 1,
    maxAttempts: 5,
    availableAt: new Date(),
    leaseToken: randomUUID(),
    lastError: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  before(async () => {
    await adminPool.query(
      `insert into tenants (id, name, slug, status)
       values ($1, 'Durable Freight Tenant', $2, 'active')`,
      [tenantId, `durable-freight-${tenantId}`],
    );
    await adminPool.query(
      `insert into freights (
        id, tenant_id, freight_type, origin_city, origin_state,
        destination_city, destination_state, cargo_description,
        quantity, weight_kg
      ) values ($1,$2,'dedicated','Santos','SP','São Paulo','SP','integration cargo',1,100)`,
      [freightId, tenantId],
    );
  });

  after(async () => {
    await adminPool.query("delete from audit_events where tenant_id = $1", [
      tenantId,
    ]);
    await adminPool.query("delete from freights where id = $1", [freightId]);
    await adminPool.query("delete from tenants where id = $1", [tenantId]);
    await runtimePool.end();
    await adminPool.end();
  });

  test("processes a freight status job idempotently after a retry", async () => {
    const handler = createFreightStatusChangedHandler(runtimePool);

    await handler(durableJob);
    await handler(durableJob);

    const freight = await adminPool.query<{ status: string }>(
      "select status from freights where id = $1",
      [freightId],
    );
    assert.equal(freight.rows[0]?.status, "open");

    const audit = await adminPool.query<{ count: string }>(
      `select count(*)::text as count
         from audit_events
        where tenant_id = $1
          and entity_type = 'freight'
          and entity_id = $2
          and action = 'freight.status_changed'`,
      [tenantId, freightId],
    );
    assert.equal(audit.rows[0]?.count, "1");
  });

  test("rejects a cross-tenant freight without changing data", async () => {
    const otherTenantId = randomUUID();
    const otherFreightId = randomUUID();
    await adminPool.query(
      `insert into tenants (id, name, slug, status)
       values ($1, 'Other Durable Freight Tenant', $2, 'active')`,
      [otherTenantId, `durable-freight-other-${otherTenantId}`],
    );
    await adminPool.query(
      `insert into freights (
        id, tenant_id, freight_type, origin_city, origin_state,
        destination_city, destination_state, cargo_description,
        quantity, weight_kg
      ) values ($1,$2,'dedicated','Santos','SP','Campinas','SP','cross tenant cargo',1,100)`,
      [otherFreightId, otherTenantId],
    );

    try {
      await assert.rejects(
        createFreightStatusChangedHandler(runtimePool)({
          ...durableJob,
          id: randomUUID(),
          payload: {
            ...durableJob.payload,
            freightId: otherFreightId,
          },
        }),
        /DURABLE_JOB_FREIGHT_NOT_FOUND/,
      );
    } finally {
      await adminPool.query("delete from freights where id = $1", [
        otherFreightId,
      ]);
      await adminPool.query("delete from tenants where id = $1", [
        otherTenantId,
      ]);
    }
  });
}
