import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";
import { withTenantContext } from "@tms/database";
import { createFreightStatusChangedHandler } from "./freight-status-changed.handler.js";
import type { DurableJob } from "./durable-jobs-worker.js";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
const enabled = process.env.RUN_DB_INTEGRATION === "true" && Boolean(adminUrl && runtimeUrl);

test("REAL replay: same event emits idempotent_replay=false then true and keeps one audit row", { skip: !enabled }, async () => {
  const admin = new Pool({ connectionString: adminUrl });
  const runtime = new Pool({ connectionString: runtimeUrl });
  const tenantId = randomUUID();
  const freightId = randomUUID();
  const eventId = randomUUID();
  const telemetry: Array<Record<string, unknown>> = [];
  try {
    await admin.query("insert into tenants (id,name,slug,status) values ($1,'Replay Evidence',$2,'active')",
      [tenantId, `replay-evidence-${tenantId}`]);
    await admin.query(`insert into freights
      (id,tenant_id,status,freight_type,origin_city,origin_state,destination_city,destination_state,cargo_description,quantity,weight_kg)
      values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','replay evidence',1,100)`,
      [freightId, tenantId]);

    const handler = createFreightStatusChangedHandler(runtime, (event, details) => {
      telemetry.push({ event, ...details });
    });
    const payload = { event_id: eventId, freight_id: freightId, from_status: "draft", to_status: "open" };
    const job = (id: string): DurableJob => ({
      id, tenantId, jobType: "freight.status_changed", payload, status: "completed",
      attempts: 1, maxAttempts: 5, availableAt: new Date(), leaseToken: null,
      lastError: null, completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });

    await handler(job(randomUUID()));
    await handler(job(randomUUID()));

    assert.equal(telemetry[0]?.idempotent_replay, false);
    assert.equal(telemetry[1]?.idempotent_replay, true);
    assert.equal(telemetry[0]?.event_id, eventId);
    assert.equal(telemetry[1]?.event_id, eventId);

    const result = await withTenantContext(runtime, tenantId, client =>
      client.query(
        `select count(*)::int as count
         from audit_events
         where tenant_id=$1 and action='freight.status_changed.processed'
           and metadata->>'event_id'=$2`,
        [tenantId, eventId],
      ),
    );
    assert.equal(result.rows[0]?.count, 1);
  } finally {
    await admin.query("delete from audit_events where tenant_id=$1",[tenantId]);
    await admin.query("delete from freights where tenant_id=$1",[tenantId]);
    await admin.query("delete from tenants where id=$1",[tenantId]);
    await runtime.end();
    await admin.end();
  }
});

test("REAL cross-tenant negative: tenant B cannot read, insert, update, or delete tenant A freight", { skip: !enabled }, async () => {
  const admin = new Pool({ connectionString: adminUrl });
  const runtime = new Pool({ connectionString: runtimeUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const freightA = randomUUID();
  try {
    await admin.query("insert into tenants (id,name,slug,status) values ($1,'RLS A',$2,'active'),($3,'RLS B',$4,'active')",
      [tenantA,`rls-a-${tenantA}`,tenantB,`rls-b-${tenantB}`]);
    await admin.query(`insert into freights
      (id,tenant_id,status,freight_type,origin_city,origin_state,destination_city,destination_state,cargo_description,quantity,weight_kg)
      values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','rls evidence',1,100)`,
      [freightA,tenantA]);

    const client = await runtime.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.tenant_id',$1,true)",[tenantB]);

      const read = await client.query("select id from freights where id=$1",[freightA]);
      assert.equal(read.rowCount,0);

      await assertDenied(client.query(`insert into freights
        (id,tenant_id,status,freight_type,origin_city,origin_state,destination_city,destination_state,cargo_description,quantity,weight_kg)
        values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','blocked',1,100)`,
        [randomUUID(),tenantA]));

      const update = await client.query("update freights set cargo_description='blocked' where id=$1",[freightA]);
      assert.equal(update.rowCount,0);

      const del = await client.query("delete from freights where id=$1",[freightA]);
      assert.equal(del.rowCount,0);

      await client.query("rollback");
    } finally {
      client.release();
    }
  } finally {
    await admin.query("delete from freights where id=$1",[freightA]);
    await admin.query("delete from tenants where id in ($1,$2)",[tenantA,tenantB]);
    await runtime.end();
    await admin.end();
  }
});

async function assertDenied(query: Promise<{ rowCount: number | null }>): Promise<void> {
  try {
    await query;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "42501") return;
    throw error;
  }
  throw new Error("cross-tenant insert was accepted");
}
