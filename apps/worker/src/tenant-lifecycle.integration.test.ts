import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { Pool } from "pg";
import { PgOutboxStore } from "./outbox-store.js";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

if (!runIntegration) {
  test("tenant lifecycle integration is disabled without CI database configuration", () => {});
} else {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
  const tenantId = randomUUID();
  const eventId = randomUUID();

  before(async () => {
    await adminPool.query(
      `insert into tenants (id, name, slug, status)
       values ($1, 'Worker lifecycle tenant', $2, 'active')`,
      [tenantId, `worker-lifecycle-${tenantId}`],
    );
    await adminPool.query(
      `insert into outbox_events
       (id, tenant_id, aggregate_type, aggregate_id, event_type, payload)
       values ($1, $2, 'freight', $3, 'freight.created', '{}'::jsonb)`,
      [eventId, tenantId, randomUUID()],
    );
  });

  after(async () => {
    await adminPool.query("delete from outbox_events where id = $1", [eventId]);
    await adminPool.query("delete from tenants where id = $1", [tenantId]);
    await runtimePool.end();
    await adminPool.end();
  });

  test("active tenant can claim, then suspension blocks the next claim", async () => {
    const store = new PgOutboxStore(runtimePool);

    const firstClaim = await store.claimPending(tenantId, 10);
    assert.equal(firstClaim.length, 1);
    assert.equal(firstClaim[0]?.id, eventId);

    await adminPool.query(
      `update outbox_events
       set status = 'pending', available_at = now()
       where id = $1`,
      [eventId],
    );
    await adminPool.query(
      "update tenants set status = 'suspended' where id = $1",
      [tenantId],
    );

    const claimAfterSuspension = await store.claimPending(tenantId, 10);
    assert.equal(claimAfterSuspension.length, 0);
  });
}
