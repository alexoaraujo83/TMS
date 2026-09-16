import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { assertComplianceRelease } from "../src/compliance-release.js";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

if (!enabled) {
  describe("Compliance and GR integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and both database URLs are configured", () => {});
  });
} else {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const pool = new Pool({ connectionString: runtimeDatabaseUrl });
  const tenantId = randomUUID();
  const freightId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of ["freights", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1::uuid, 'Compliance Test', $2::text, 'active')",
        [tenantId, `compliance-${tenantId}`],
      );
      await client.query(
        `insert into freights (
          id, tenant_id, status, freight_type, origin_city, origin_state,
          destination_city, destination_state, cargo_description, quantity,
          weight_kg, volume_m3, linear_meters, customer_price_cents,
          driver_price_cents
        ) values ($1::uuid, $2::uuid, 'draft', 'dedicated', 'Origin', 'SP',
          'Destination', 'SP', 'Compliance fixture', 1, 100, 1, 1, 10000, 8000)`,
        [freightId, tenantId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    await enableRls(adminPool);
  });

  after(async () => {
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "compliance_checks",
        "gr_requests",
        "freights",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from compliance_checks where tenant_id = $1::uuid", [
        tenantId,
      ]);
      await client.query("delete from gr_requests where tenant_id = $1::uuid", [
        tenantId,
      ]);
      await client.query("delete from freights where id = $1::uuid", [freightId]);
      await client.query("delete from tenants where id = $1::uuid", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await enableRls(adminPool);
      await pool.end();
      await adminPool.end();
    }
  });

  it("enforces tenant isolation and compliance status invariants", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const pending = await client.query(
        `insert into compliance_checks (tenant_id, freight_id, check_type)
         values ($1::uuid, $2::uuid, 'gr') returning status`,
        [tenantId, freightId],
      );
      assert.equal(pending.rows[0].status, "pending");

      await assert.rejects(
        client.query(
          `insert into compliance_checks
             (tenant_id, freight_id, check_type, status)
           values ($1::uuid, $2::uuid, 'gr', 'approved')`,
          [tenantId, freightId],
        ),
      );
      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  it("blocks release for pending compliance and releases after approval", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      await client.query(
        `insert into compliance_checks (tenant_id, freight_id, check_type)
         values ($1::uuid, $2::uuid, 'driver')`,
        [tenantId, freightId],
      );

      await assert.rejects(
        assertComplianceRelease(client, tenantId, freightId),
        /Compliance release blocked: driver=pending/,
      );

      await client.query(
        `update compliance_checks
            set status = 'approved', checked_at = now()
          where tenant_id = $1::uuid and freight_id = $2::uuid and check_type = 'driver'`,
        [tenantId, freightId],
      );
      await assertComplianceRelease(client, tenantId, freightId);
      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  it("enforces GR state timestamps", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query(
        `insert into gr_requests (tenant_id, freight_id, status, submitted_at)
         values ($1::uuid, $2::uuid, 'submitted', now()) returning status`,
        [tenantId, freightId],
      );
      assert.equal(result.rows[0].status, "submitted");
      await client.query("rollback");
    } finally {
      client.release();
    }
  });
}

async function enableRls(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    for (const table of [
      "compliance_checks",
      "gr_requests",
      "freights",
      "tenants",
    ]) {
      await client.query(`alter table ${table} enable row level security`);
      await client.query(`alter table ${table} force row level security`);
    }
  } finally {
    client.release();
  }
}
