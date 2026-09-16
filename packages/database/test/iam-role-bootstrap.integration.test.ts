import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

if (!enabled) {
  describe("IAM role bootstrap integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and admin/runtime database URLs are configured", () => {});
  });
} else {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await adminPool.connect();
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
        "insert into tenants (id, name, slug, status) values ($1::uuid, 'IAM Test', $2::text, 'active')",
        [tenantId, `iam-${tenantId}`],
      );
      await client.query(
        "insert into users (id, email, display_name, status) values ($1::uuid, $2::text, 'IAM Test', 'active')",
        [userId, `iam-${userId}@test.local`],
      );
      await client.query(
        "insert into roles (tenant_id, name, description) values ($1::uuid, 'operator', 'IAM integration operator')",
        [tenantId],
      );
      await client.query(
        `insert into role_permissions (role_id, permission_id)
         select r.id, p.id
           from roles r
           cross join permissions p
          where r.tenant_id = $1::uuid
            and r.name = 'operator'
            and p.code in (
              'freight:read', 'matching:assign',
              'trip:read', 'trip:create', 'trip:update'
            )`,
        [tenantId],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role, role_id)
         values (
           $1::uuid,
           $2::uuid,
           'operator',
           (select id from roles where tenant_id = $2::uuid and name = 'operator')
         )`,
        [userId, tenantId],
      );
      for (const table of [
        "role_permissions",
        "roles",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} enable row level security`);
        await client.query(`alter table ${table} force row level security`);
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
    const client = await adminPool.connect();
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
        "delete from tenant_memberships where tenant_id = $1::uuid",
        [tenantId],
      );
      await client.query("delete from users where id = $1::uuid", [userId]);
      await client.query("delete from tenants where id = $1::uuid", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await runtimePool.end();
      await adminPool.end();
    }
  });

  it("resolves operator membership to a canonical role with operational and trip permissions", async () => {
    const client = await runtimePool.connect();
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
          where tm.tenant_id = $1::uuid and tm.user_id = $2::uuid
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

  it("resolves a new operator membership while tenant RLS is enabled", async () => {
    const adminClient = await adminPool.connect();
    try {
      await adminClient.query("begin");
      await adminClient.query(
        "delete from tenant_memberships where tenant_id = $1::uuid and user_id = $2::uuid",
        [tenantId, userId],
      );
      for (const table of [
        "role_permissions",
        "roles",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await adminClient.query(`alter table ${table} enable row level security`);
        await adminClient.query(`alter table ${table} force row level security`);
      }
      await adminClient.query("commit");
    } catch (error) {
      await adminClient.query("rollback");
      throw error;
    } finally {
      adminClient.release();
    }

    const client = await runtimePool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);

      const result = await client.query<{ roleId: string | null }>(
        `insert into tenant_memberships (user_id, tenant_id, role, role_id)
         values (
           $1::uuid,
           $2::uuid,
           'operator',
           (select id from roles where tenant_id = $2::uuid and name = 'operator')
         )
         returning role_id as "roleId"`,
        [userId, tenantId],
      );

      assert.equal(result.rowCount, 1);
      assert.ok(result.rows[0].roleId);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });
}
