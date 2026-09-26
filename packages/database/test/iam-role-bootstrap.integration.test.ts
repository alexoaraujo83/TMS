import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const databaseAdminUrl = process.env.DATABASE_ADMIN_URL ?? databaseUrl;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("IAM role bootstrap integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const adminPool = new Pool({ connectionString: databaseAdminUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();
  let operatorRoleId: string;

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await adminPool.connect();
    try {
      await client.query("begin");
      operatorRoleId = randomUUID();
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1, 'IAM Test', $2, 'active')",
        [tenantId, `iam-${tenantId}`],
      );
      await client.query(
        "insert into roles (id, tenant_id, name, description) values ($1, $2, 'operator', 'Integration test operator role')",
        [operatorRoleId, tenantId],
      );
      await client.query(
        `insert into role_permissions (role_id, permission_id)
         select $1, id from permissions
         where code in ('freight:read', 'matching:assign', 'trip:read', 'trip:create', 'trip:update')`,
        [operatorRoleId],
      );
      await client.query(
        "insert into users (id, email, display_name, status) values ($1, $2, 'IAM Test', 'active')",
        [userId, `iam-${userId}@test.local`],
      );
      await client.query(
        "insert into tenant_memberships (user_id, tenant_id, role, role_id) values ($1, $2, 'operator', $3)",
        [userId, tenantId, operatorRoleId],
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
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      await client.query(
        "delete from tenant_memberships where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from role_permissions where role_id = $1", [
        operatorRoleId,
      ]);
      await client.query("delete from roles where id = $1", [operatorRoleId]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
      await adminPool.end();
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
      assert.equal(result.rows[0].roleId, operatorRoleId);
      assert.ok(result.rows[0].permissions.includes("freight:read"));
      assert.ok(result.rows[0].permissions.includes("matching:assign"));
      assert.ok(result.rows[0].permissions.includes("trip:read"));
      assert.ok(result.rows[0].permissions.includes("trip:create"));
      assert.ok(result.rows[0].permissions.includes("trip:update"));
      assert.equal(result.rows[0].permissions.includes("iam:manage"), false);
      assert.equal(result.rows[0].permissions.includes("freight:replay"), false);
      assert.equal(result.rows[0].permissions.includes("ops:diagnostics"), false);
    } finally {
      client.release();
    }
  });

  it("resolves a new operator membership while tenant RLS is enabled", async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      await client.query(
        "delete from tenant_memberships where tenant_id = $1 and user_id = $2",
        [tenantId, userId],
      );

      const result = await client.query<{ roleId: string | null }>(
        `insert into tenant_memberships (user_id, tenant_id, role, role_id)
         values ($1, $2, 'operator', $3)
         returning role_id as "roleId"`,
        [userId, tenantId, operatorRoleId],
      );

      assert.equal(result.rowCount, 1);
      assert.equal(result.rows[0].roleId, operatorRoleId);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}
