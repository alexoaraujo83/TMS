import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after, before, describe, it } from "node:test";

const databaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!runIntegration) {
  describe("updated_at integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const tenantId = randomUUID();
  const userId = randomUUID();
  let carrierId = "";

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of ["carriers", "users", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }

      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'Updated At Test', $2, 'active')`,
        [tenantId, `updated-at-${tenantId}`],
      );
      await client.query(
        `insert into users (id, email, display_name, status)
         values ($1, $2, 'Updated At User', 'active')`,
        [userId, `updated-at-${userId}@test.local`],
      );
      const carrier = await client.query<{ id: string }>(
        `insert into carriers (tenant_id, legal_name, document_number)
         values ($1, 'Updated At Carrier', $2)
         returning id`,
        [tenantId, `updated-at-${tenantId}`],
      );
      carrierId = carrier.rows[0].id;
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
      for (const table of ["carriers", "users", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from carriers where tenant_id = $1", [tenantId]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  describe("database timestamp authority", () => {
    it("updates carrier.updated_at when the row changes", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("alter table carriers disable row level security");
        const before = await client.query<{ updatedAt: Date }>(
          `select updated_at as "updatedAt" from carriers where id = $1`,
          [carrierId],
        );
        await client.query("select pg_sleep(0.01)");
        await client.query(
          `update carriers set legal_name = 'Updated At Carrier 2' where id = $1`,
          [carrierId],
        );
        const after = await client.query<{ updatedAt: Date }>(
          `select updated_at as "updatedAt" from carriers where id = $1`,
          [carrierId],
        );
        await client.query("rollback");

        const beforeAt = before.rows[0]?.updatedAt.getTime();
        const afterAt = after.rows[0]?.updatedAt.getTime();
        if (beforeAt === undefined || afterAt === undefined || afterAt <= beforeAt) {
          throw new Error("updated_at trigger did not advance the timestamp");
        }
      } finally {
        client.release();
      }
    });

    it("installs triggers on every mutable table with updated_at", async () => {
      const client = await pool.connect();
      try {
        const result = await client.query<{ tableName: string }>(
          `select c.relname as "tableName"
             from pg_trigger t
             join pg_class c on c.oid = t.tgrelid
             join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public'
              and t.tgname like 'trg_%_updated_at'
              and not t.tgisinternal
            order by c.relname`,
        );
        const actual = result.rows.map((row) => row.tableName);
        const expected = [
          "carriers",
          "drivers",
          "freight_assignments",
          "freights",
          "tenants",
          "users",
          "vehicles",
        ];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(
            `updated_at trigger set mismatch: ${JSON.stringify(actual)}`,
          );
        }
      } finally {
        client.release();
      }
    });
  });
}
