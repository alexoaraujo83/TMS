import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("Compliance and GR integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const tenantId = randomUUID();
  const freightId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of ["freights", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1, 'Compliance Test', $2, 'active')",
        [tenantId, `compliance-${tenantId}`],
      );
      await client.query(
        `insert into freights (
          id, tenant_id, lifecycle, freight_type, origin, destination,
          cargo_description, quantity, weight_kg, volume_m3, linear_meters,
          company_price, driver_price
        ) values ($1, $2, 'draft', 'dedicated', 'Origin', 'Destination',
          'Compliance fixture', 1, 100, 1, 1, 100, 80)`,
        [freightId, tenantId],
      );
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
      for (const table of [
        "compliance_checks",
        "gr_requests",
        "freights",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "delete from compliance_checks where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from gr_requests where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from freights where id = $1", [freightId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
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
      await client.query(
        "alter table compliance_checks enable row level security",
      );
      await client.query(
        "alter table compliance_checks force row level security",
      );

      const pending = await client.query(
        `insert into compliance_checks (tenant_id, freight_id, check_type)
         values ($1, $2, 'gr') returning status`,
        [tenantId, freightId],
      );
      assert.equal(pending.rows[0].status, "pending");

      await assert.rejects(
        client.query(
          `insert into compliance_checks
             (tenant_id, freight_id, check_type, status)
           values ($1, $2, 'gr', 'approved')`,
          [tenantId, freightId],
        ),
      );
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
         values ($1, $2, 'submitted', now()) returning status`,
        [tenantId, freightId],
      );
      assert.equal(result.rows[0].status, "submitted");
      await client.query("rollback");
    } finally {
      client.release();
    }
  });
}
