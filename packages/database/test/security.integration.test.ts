import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, it, before, after } from "node:test";

const adminDatabaseUrl = process.env.DATABASE_ADMIN_URL;
const runtimeDatabaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" &&
  Boolean(adminDatabaseUrl) &&
  Boolean(runtimeDatabaseUrl);

if (!runIntegration) {
  describe("database security integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_ADMIN_URL/DATABASE_URL are configured", () => {});
  });
} else {
  const adminPool = new Pool({ connectionString: adminDatabaseUrl });
  const runtimePool = new Pool({ connectionString: runtimeDatabaseUrl });
  let tenantA: string;
  let tenantB: string;
  let userA: string;
  let userB: string;
  let auth0SubjectA: string;
  let auth0SubjectB: string;
  let freightA: string;

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: adminDatabaseUrl,
      },
      stdio: "inherit",
    });

    // The admin connection is used only for fixture provisioning and cleanup.
    // All isolation assertions run through the restricted runtime role.
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "audit_events",
        "freights",
        "vehicles",
        "drivers",
        "carriers",
        "role_permissions",
        "roles",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }

      tenantA = randomUUID();
      tenantB = randomUUID();
      userA = randomUUID();
      userB = randomUUID();
      auth0SubjectA = "auth0|user-a";
      auth0SubjectB = "auth0|user-b";
      freightA = randomUUID();

      await client.query(
        `insert into tenants (id, name, slug, status) values ($1, 'Tenant A', $3, 'active'), ($2, 'Tenant B', $4, 'active')`,
        [tenantA, tenantB, `tenant-a-${tenantA}`, `tenant-b-${tenantB}`],
      );
      await client.query(
        `insert into users (id, auth0_subject, email, display_name, status) values ($1, $3, 'a@test.local', 'User A', 'active'), ($2, $4, 'b@test.local', 'User B', 'active')`,
        [userA, userB, auth0SubjectA, auth0SubjectB],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role) values ($1,$2,'operator'),($3,$4,'operator')`,
        [userA, tenantA, userB, tenantB],
      );
      await client.query(
        `insert into freights (id, tenant_id, status, freight_type, origin_city, origin_state, destination_city, destination_state, cargo_description, quantity, weight_kg)
         values ($1,$2,'open','dedicated','Santos','SP','São Paulo','SP','test cargo',1,100)`,
        [freightA, tenantA],
      );

      for (const table of [
        "audit_events",
        "freights",
        "vehicles",
        "drivers",
        "carriers",
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
        "audit_events",
        "freights",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from audit_events");
      await client.query("delete from freights");
      await client.query("delete from tenant_memberships");
      await client.query("delete from users");
      await client.query("delete from tenants");
      await client.query("commit");
    } finally {
      client.release();
      await runtimePool.end();
      await adminPool.end();
    }
  });

  describe("tenant isolation and membership bootstrap", () => {
    it("isolates tenant-owned resources through RLS", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantB,
        ]);
        const result = await client.query(
          "select id from freights where id = $1",
          [freightA],
        );
        await client.query("rollback");
        if (result.rowCount !== 0)
          throw new Error("cross-tenant freight became visible");
      } finally {
        client.release();
      }
    });

    it("does not allow a forged tenant context to reveal another tenant resource", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantB,
        ]);
        const result = await client.query(
          "select id from freights where tenant_id = $1",
          [tenantA],
        );
        await client.query("rollback");
        if (result.rowCount !== 0)
          throw new Error("forged tenant context bypassed RLS");
      } finally {
        client.release();
      }
    });

    it("rejects cross-tenant inserts through WITH CHECK", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantB,
        ]);
        await assertRlsViolation(
          client.query(
            `insert into freights (id, tenant_id, status, freight_type, origin_city, origin_state, destination_city, destination_state, cargo_description, quantity, weight_kg)
             values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','cross-tenant insert',1,100)`,
            [randomUUID(), tenantA],
          ),
          "cross-tenant freight insert was accepted",
        );
        await client.query("rollback");
      } finally {
        client.release();
      }
    });

    it("rejects changing a row to another tenant through WITH CHECK", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantA,
        ]);
        await assertRlsViolation(
          client.query("update freights set tenant_id = $1 where id = $2", [
            tenantB,
            freightA,
          ]),
          "tenant_id reassignment bypassed RLS",
        );
        await client.query("rollback");
      } finally {
        client.release();
      }
    });

    it("cannot delete a row outside the active tenant", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantB,
        ]);
        const result = await client.query(
          "delete from freights where id = $1",
          [freightA],
        );
        await client.query("rollback");
        if (result.rowCount !== 0)
          throw new Error("cross-tenant freight delete was accepted");
      } finally {
        client.release();
      }
    });

    it("denies tenant-owned rows when no tenant context is installed", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        const result = await client.query("select id from freights");
        if (result.rowCount !== 0)
          throw new Error("freight rows are visible without tenant context");
        await assertRlsViolation(
          client.query(
            `insert into freights (id, tenant_id, status, freight_type, origin_city, origin_state, destination_city, destination_state, cargo_description, quantity, weight_kg)
             values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','missing context',1,100)`,
            [randomUUID(), tenantA],
          ),
          "freight insert was accepted without tenant context",
        );
        await client.query("rollback");
      } finally {
        client.release();
      }
    });

    it("switches tenant visibility only within the active transaction", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantA,
        ]);
        const tenantAResult = await client.query(
          "select id from freights where id = $1",
          [freightA],
        );
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantB,
        ]);
        const tenantBResult = await client.query(
          "select id from freights where id = $1",
          [freightA],
        );
        await client.query("rollback");
        if (tenantAResult.rowCount !== 1 || tenantBResult.rowCount !== 0)
          throw new Error("tenant context switching did not isolate rows");
      } finally {
        client.release();
      }
    });

    it("keeps the membership bootstrap function non-public and callable by the runtime role", async () => {
      const client = await runtimePool.connect();
      try {
        const privileges = await client.query(
          `select has_function_privilege(current_user, 'public.check_tenant_membership(text, uuid)', 'execute') as executable,
                  has_function_privilege('public', 'public.check_tenant_membership(text, uuid)', 'execute') as public_executable`,
        );
        if (!privileges.rows[0].executable)
          throw new Error("runtime role cannot execute membership bootstrap");
        if (privileges.rows[0].public_executable)
          throw new Error("membership bootstrap is executable by PUBLIC");

        const result = await client.query(
          `select user_id as "userId", tenant_id as "tenantId", role, permissions, active
             from public.check_tenant_membership($1, $2)`,
          [auth0SubjectA, tenantA],
        );
        if (
          result.rowCount !== 1 ||
          result.rows[0].userId !== userA ||
          result.rows[0].tenantId !== tenantA ||
          !result.rows[0].active
        ) {
          throw new Error(
            "membership bootstrap returned an invalid authoritative result",
          );
        }
      } finally {
        client.release();
      }
    });

    it("does not resolve an Auth0 subject from another tenant", async () => {
      const client = await runtimePool.connect();
      try {
        const result = await client.query(
          `select user_id as "userId", tenant_id as "tenantId"
             from public.check_tenant_membership($1, $2)`,
          [auth0SubjectA, tenantB],
        );
        if (result.rowCount !== 0)
          throw new Error(
            "cross-tenant Auth0 subject resolved as a membership",
          );
      } finally {
        client.release();
      }
    });

    it("keeps tenant context transaction-scoped", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantA,
        ]);
        const inside = await client.query<{ value: string }>(
          "select current_setting('app.tenant_id', true) as value",
        );
        await client.query("commit");
        const outside = await client.query<{ value: string | null }>(
          "select nullif(current_setting('app.tenant_id', true), '') as value",
        );
        if (inside.rows[0]?.value !== tenantA)
          throw new Error(
            "tenant context was not installed inside transaction",
          );
        if (outside.rows[0]?.value !== null)
          throw new Error("tenant context leaked outside transaction");
      } finally {
        client.release();
      }
    });
  });
}

async function assertRlsViolation(
  query: Promise<{ rowCount: number | null }>,
  message: string,
): Promise<void> {
  try {
    await query;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "42501"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(message);
}
