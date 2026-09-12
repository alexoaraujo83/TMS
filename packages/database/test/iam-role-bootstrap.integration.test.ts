import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("IAM role bootstrap integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "role_permissions",
        "roles",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1, 'IAM Test', $2, 'active')",
        [tenantId, `iam-${tenantId}`],
      );
      await client.query(
        "insert into users (id, email, display_name, status) values ($1, $2, 'IAM Test', 'active')",
        [userId, `iam-${userId}@test.local`],
      );
      await client.query(
        "insert into tenant_memberships (user_id, tenant_id, role) values ($1, $2, 'operator')",
        [userId, tenantId],
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
        "role_permissions",
        "roles",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from tenant_memberships where tenant_id = $1", [tenantId]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("resolves operator membership to a canonical role with operational and trip permissions", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query<{
        role: string;
        roleId: string | null;
        permissions: string[];
      }>(
        `select coalesce(r.name, tm.role) as role,
                tm.role_id as "roleId",
                coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') as permissions
           from tenant_memberships tm
           left join roles r on r.id = tm.role_id
           left join role_permissions rp on rp.role_id = r.id
           left join permissions p on p.id = rp.permission_id
          where tm.tenant_id = $1 and tm.user_id = $2
          group by r.name, tm.role, tm.role_id`,
        [tenantId, userId],
      );
      await client.query("commit");

      assert.equal(result.rowCount, 1);
      assert.equal(result.rows[0].role, "operator");
      assert.ok(result.rows[0].roleId);
      assert.ok(result.rows[0].permissions.includes("freight:read"));
      assert.ok(result.rows[0].permissions.includes("matching:assign"));
      assert.ok(result.rows[0].permissions.includes("trip:read"));
      assert.ok(result.rows[0].permissions.includes("trip:create"));
      assert.ok(result.rows[0].permissions.includes("trip:update"));
      assert.equal(result.rows[0].permissions.includes("iam:manage"), false);
    } finally {
      client.release();
    }
  });
}
