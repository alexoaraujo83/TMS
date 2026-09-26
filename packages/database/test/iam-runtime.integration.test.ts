import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after, before, describe, it } from "node:test";

const ownerUrl = process.env.DATABASE_ADMIN_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
const runIntegration = Boolean(ownerUrl && runtimeUrl);

if (!runIntegration) {
  describe("database IAM runtime integration", () => {
    it("is disabled unless DATABASE_ADMIN_URL and RUNTIME_DATABASE_URL are configured", () => {});
  });
} else {
  const ownerPool = new Pool({ connectionString: ownerUrl });
  const runtimePool = new Pool({ connectionString: runtimeUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();
  const roleId = randomUUID();
  const auth0Subject = `auth0|runtime-${userId}`;
  const bootstrapTenantId = randomUUID();
  const bootstrapRoleId = randomUUID();
  const bootstrapUserId = randomUUID();
  const bootstrapAuth0Subject = `auth0|bootstrap-${bootstrapUserId}`;
  const existingUserId = randomUUID();
  const existingAuth0Subject = `auth0|existing-${existingUserId}`;

  before(async () => {
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'IAM Runtime', $2, 'active')`,
        [tenantId, `iam-runtime-${tenantId}`],
      );
      await client.query(
        `insert into users (id, auth0_subject, email, display_name, status)
         values ($1, $2, $3, 'Runtime User', 'active')`,
        [userId, auth0Subject, `${userId}@test.local`],
      );
      await client.query(
        `insert into roles (id, tenant_id, name, description)
         values ($1, $2, 'operator', 'runtime integration role')`,
        [roleId, tenantId],
      );
      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role, role_id)
         values ($1, $2, 'operator', $3)`,
        [tenantId, userId, roleId],
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
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query("delete from tenant_memberships where tenant_id in ($1, $2)", [tenantId, bootstrapTenantId]);
      await client.query("delete from roles where id in ($1, $2)", [roleId, bootstrapRoleId]);
      await client.query("delete from users where id in ($1, $2, $3)", [userId, bootstrapUserId, existingUserId]);
      await client.query("delete from tenants where id in ($1, $2)", [tenantId, bootstrapTenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await runtimePool.end();
      await ownerPool.end();
    }
  });

  it("bootstraps a new Auth0 identity idempotently and does not self-enroll an existing identity", async () => {
    const client = await ownerPool.connect();
    try {
      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'Bootstrap Runtime', $2, 'active')`,
        [bootstrapTenantId, `bootstrap-runtime-${bootstrapTenantId}`],
      );
      await client.query(
        `insert into roles (id, tenant_id, name, description)
         values ($1, $2, 'operator', 'bootstrap integration role')`,
        [bootstrapRoleId, bootstrapTenantId],
      );
      await client.query(
        `insert into users (id, auth0_subject, email, display_name, status)
         values ($1, $2, $3, 'Existing User', 'active')`,
        [existingUserId, existingAuth0Subject, `${existingUserId}@test.local`],
      );
    } finally {
      client.release();
    }

    const first = await runtimePool.query(
      `select user_id as "userId", tenant_id as "tenantId", linked
         from public.bootstrap_auth0_identity($1, $2, $3, $4::uuid)`,
      [
        bootstrapAuth0Subject,
        `${bootstrapUserId}@test.local`,
        "Bootstrap User",
        bootstrapTenantId,
      ],
    );
    if (
      first.rowCount !== 1 ||
      first.rows[0]?.tenantId !== bootstrapTenantId ||
      !first.rows[0]?.linked
    ) {
      throw new Error("first Auth0 bootstrap did not create the initial tenant membership");
    }

    const second = await runtimePool.query(
      `select user_id as "userId", tenant_id as "tenantId", linked
         from public.bootstrap_auth0_identity($1, $2, $3, $4::uuid)`,
      [
        bootstrapAuth0Subject,
        `${bootstrapUserId}@test.local`,
        "Bootstrap User",
        bootstrapTenantId,
      ],
    );
    if (
      second.rowCount !== 1 ||
      second.rows[0]?.userId !== first.rows[0]?.userId ||
      second.rows[0]?.tenantId !== bootstrapTenantId ||
      !second.rows[0]?.linked
    ) {
      throw new Error("second Auth0 bootstrap was not idempotent");
    }

    const existing = await runtimePool.query(
      `select user_id as "userId", tenant_id as "tenantId", linked
         from public.bootstrap_auth0_identity($1, $2, $3, $4::uuid)`,
      [
        existingAuth0Subject,
        `${existingUserId}@test.local`,
        "Existing User",
        bootstrapTenantId,
      ],
    );
    if (
      existing.rowCount !== 1 ||
      existing.rows[0]?.userId !== existingUserId ||
      existing.rows[0]?.tenantId !== null ||
      existing.rows[0]?.linked
    ) {
      throw new Error("existing local identity gained an implicit tenant membership");
    }

    const membershipCount = await ownerPool.query(
      `select count(*)::int as count
         from tenant_memberships
        where tenant_id = $1`,
      [bootstrapTenantId],
    );
    if (membershipCount.rows[0]?.count !== 1) {
      throw new Error("unexpected bootstrap tenant membership count");
    }
  });

  it("allows the runtime role to execute the authoritative membership resolver", async () => {
    const client = await runtimePool.connect();
    try {
      const privileges = await client.query(
        `select has_function_privilege(current_user, 'public.check_tenant_membership(text, uuid)', 'execute') as executable,
                has_function_privilege('public', 'public.check_tenant_membership(text, uuid)', 'execute') as public_executable`,
      );
      if (!privileges.rows[0]?.executable) {
        throw new Error("runtime role cannot execute membership resolver");
      }
      if (privileges.rows[0]?.public_executable) {
        throw new Error("membership resolver is executable by PUBLIC");
      }

      const result = await client.query(
        `select user_id as "userId", tenant_id as "tenantId", role, active
           from public.check_tenant_membership($1, $2)`,
        [auth0Subject, tenantId],
      );
      if (
        result.rowCount !== 1 ||
        result.rows[0]?.userId !== userId ||
        result.rows[0]?.tenantId !== tenantId ||
        result.rows[0]?.role !== "operator" ||
        !result.rows[0]?.active
      ) {
        throw new Error("membership resolver returned an invalid authoritative result");
      }
    } finally {
      client.release();
    }
  });
}
