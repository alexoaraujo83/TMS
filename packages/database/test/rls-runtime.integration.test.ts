import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after, before, describe, it } from "node:test";

const ownerUrl = process.env.DATABASE_URL;
const runtimeUrl = process.env.RUNTIME_DATABASE_URL;
const runIntegration = Boolean(ownerUrl && runtimeUrl);

if (!runIntegration) {
  describe("database RLS runtime integration", () => {
    it("is disabled unless DATABASE_URL and RUNTIME_DATABASE_URL are configured", () => {});
  });
} else {
  const ownerPool = new Pool({ connectionString: ownerUrl });
  const runtimePool = new Pool({ connectionString: runtimeUrl });
  let tenantA: string;
  let tenantB: string;
  let freightA: string;

  before(async () => {
    tenantA = randomUUID();
    tenantB = randomUUID();
    freightA = randomUUID();
    const client = await ownerPool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'RLS Runtime A', $3, 'active'), ($2, 'RLS Runtime B', $4, 'active')`,
        [tenantA, tenantB, `rls-runtime-${tenantA}`, `rls-runtime-${tenantB}`],
      );
      await client.query(
        `insert into freights
          (id, tenant_id, status, freight_type, origin_city, origin_state,
           destination_city, destination_state, cargo_description, quantity, weight_kg)
         values ($1,$2,'open','dedicated','Santos','SP','São Paulo','SP','runtime isolation',1,100)`,
        [freightA, tenantA],
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
      await client.query("delete from freights where id = $1", [freightA]);
      await client.query("delete from tenants where id in ($1, $2)", [tenantA, tenantB]);
      await client.query("commit");
    } finally {
      client.release();
      await runtimePool.end();
      await ownerPool.end();
    }
  });

  describe("non-bypass runtime role", () => {
    it("cannot read another tenant's freight", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantB]);
        const result = await client.query("select id from freights where id = $1", [freightA]);
        await client.query("rollback");
        if (result.rowCount !== 0) throw new Error("cross-tenant freight became visible");
      } finally {
        client.release();
      }
    });

    it("cannot insert a row for another tenant", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantB]);
        await assertDenied(
          client.query(
            `insert into freights
              (id, tenant_id, status, freight_type, origin_city, origin_state,
               destination_city, destination_state, cargo_description, quantity, weight_kg)
             values ($1,$2,'open','dedicated','Santos','SP','Campinas','SP','cross tenant',1,100)`,
            [randomUUID(), tenantA],
          ),
        );
        await client.query("rollback");
      } finally {
        client.release();
      }
    });

    it("cannot reassign an owned row to another tenant", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantA]);
        await assertDenied(
          client.query("update freights set tenant_id = $1 where id = $2", [tenantB, freightA]),
        );
        await client.query("rollback");
      } finally {
        client.release();
      }
    });

    it("cannot delete another tenant's row", async () => {
      const client = await runtimePool.connect();
      try {
        await client.query("begin");
        await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantB]);
        const result = await client.query("delete from freights where id = $1", [freightA]);
        await client.query("rollback");
        if (result.rowCount !== 0) throw new Error("cross-tenant freight delete was accepted");
      } finally {
        client.release();
      }
    });

    it("does not leak tenant context across pooled connections", async () => {
      const first = await runtimePool.connect();
      try {
        await first.query("begin");
        await first.query("select set_config($1, $2, true)", ["app.tenant_id", tenantA]);
        await first.query("commit");
      } finally {
        first.release();
      }
      const second = await runtimePool.connect();
      try {
        const result = await second.query<{ value: string | null }>(
          "select nullif(current_setting('app.tenant_id', true), '') as value",
        );
        if (result.rows[0]?.value !== null) throw new Error("tenant context leaked through pool reuse");
      } finally {
        second.release();
      }
    });
  });
}

async function assertDenied(query: Promise<{ rowCount: number | null }>): Promise<void> {
  try {
    await query;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "42501") return;
    throw error;
  }
  throw new Error("cross-tenant mutation was accepted");
}
