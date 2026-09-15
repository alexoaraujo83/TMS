import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, it, before, after } from "node:test";

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
const runIntegration = Boolean(ownerUrl && runtimeUrl);

if (!runIntegration) {
  describe("database IAM runtime integration", () => {
    it("is disabled unless DATABASE_URL and RUNTIME_DATABASE_URL are configured", () => {});
  });
} else {
  const ownerPool = new Pool({ connectionString: ownerUrl });
  const runtimePool = new Pool({ connectionString: runtimeUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();
  const auth0Subject = `auth0|runtime-${userId}`;

  before(async () => {
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into tenants (id, name, slug, status) values ($1, 'IAM Runtime', $1, 'active')`,
        [tenantId],
      );
      await client.query(
        `insert into users (id, auth0_subject, email, display_name, status)
         values ($1, $2, $3, 'Runtime User', 'active')`,
        [userId, auth0Subject, `${userId}@test.local`],
      );
      await client.query(
        `insert into tenant_memberships (tenant_id, user_id, role)
         values ($1, $2, 'operator')`,
        [tenantId, userId],
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
      await client.query("delete from tenant_memberships where tenant_id = $1", [tenantId]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await runtimePool.end();
      await ownerPool.end();
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
