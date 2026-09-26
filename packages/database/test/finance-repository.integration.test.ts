import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { FinanceRepository } from "../src/finance-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const databaseAdminUrl = process.env.DATABASE_ADMIN_URL ?? databaseUrl;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("Finance repository integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const adminPool = new Pool({ connectionString: databaseAdminUrl });
  const finance = new FinanceRepository(pool);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const freightId = randomUUID();
  const otherFreightId = randomUUID();
  const audit = {
    actorUserId: randomUUID(),
    action: "finance.test_mutation",
    entityType: "financial_entry",
    requestId: randomUUID(),
  };
  const createFinancialEntry = (input: Parameters<typeof finance.create>[0]) =>
    finance.create(input, audit);
  const settleFinancialEntry = (tenantId: string, id: string) =>
    finance.settle(tenantId, id, audit);

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of ["financial_entries", "freights", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      for (const [id, suffix] of [
        [tenantId, "finance-a"],
        [otherTenantId, "finance-b"],
      ]) {
        await client.query(
          "insert into tenants (id, name, slug, status) values ($1, $2, $3, 'active')",
          [id, `Finance Test ${suffix}`, `${suffix}-${id}`],
        );
      }
      await client.query(
        `insert into freights (
          id, tenant_id, lifecycle, freight_type, origin, destination,
          cargo_description, quantity, weight_kg, volume_m3, linear_meters,
          company_price, driver_price
        ) values ($1, $2, 'draft', 'dedicated', 'Origin', 'Destination',
          'Finance fixture', 1, 100, 1, 1, 100, 80),
        ($3, $4, 'draft', 'dedicated', 'Origin B', 'Destination B',
          'Finance fixture B', 1, 100, 1, 1, 100, 80)`,
        [freightId, tenantId, otherFreightId, otherTenantId],
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
        "alter table financial_entries disable row level security",
      );
      await client.query("alter table freights disable row level security");
      await client.query("alter table tenants disable row level security");
      await client.query(
        "delete from financial_entries where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query("delete from freights where id in ($1, $2)", [
        freightId,
        otherFreightId,
      ]);
      await client.query("delete from tenants where id in ($1, $2)", [
        tenantId,
        otherTenantId,
      ]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
      await adminPool.end();
    }
  });

  it("creates, lists and settles a tenant financial entry", async () => {
    const entry = await createFinancialEntry({
      tenantId,
      freightId,
      direction: "receivable",
      entryType: "freight",
      description: "Freight receivable",
      amountCents: 125000,
      dueAt: new Date("2026-10-01T12:00:00.000Z"),
      externalReference: `finance-${tenantId}`,
      metadata: { source: "integration-test" },
    });

    assert.equal(entry.tenantId, tenantId);
    assert.equal(entry.freightId, freightId);
    assert.equal(entry.amountCents, 125000);
    assert.equal(entry.currency, "BRL");
    assert.equal(entry.status, "pending");
    assert.equal(entry.settledAt, null);

    const listed = await finance.listByFreight(tenantId, freightId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, entry.id);

    const settled = await settleFinancialEntry(tenantId, entry.id);
    assert.equal(settled.id, entry.id);
    assert.equal(settled.status, "settled");
    assert.ok(settled.settledAt instanceof Date);
  });

  it("does not expose another tenant's entries", async () => {
    await createFinancialEntry({
      tenantId,
      freightId,
      direction: "payable",
      entryType: "carrier",
      description: "Carrier payable",
      amountCents: 80000,
      externalReference: `payable-${tenantId}`,
    });

    const visibleToOtherTenant = await finance.listByFreight(
      otherTenantId,
      freightId,
    );
    assert.deepEqual(visibleToOtherTenant, []);

    await assert.rejects(
      createFinancialEntry({
        tenantId: otherTenantId,
        freightId,
        direction: "receivable",
        entryType: "freight",
        description: "Cross-tenant attempt",
        amountCents: 100,
      }),
    );
  });

  it("rejects a second settlement of the same entry", async () => {
    const entry = await createFinancialEntry({
      tenantId,
      freightId,
      direction: "payable",
      entryType: "driver",
      description: "Driver payable",
      amountCents: 50000,
      externalReference: `driver-${tenantId}`,
    });

    await settleFinancialEntry(tenantId, entry.id);
    await assert.rejects(
      settleFinancialEntry(tenantId, entry.id),
      /FINANCIAL_ENTRY_NOT_SETTLEABLE/,
    );
  });

  it("prevents mutation of a settled entry", async () => {
    const entry = await createFinancialEntry({
      tenantId,
      freightId,
      direction: "receivable",
      entryType: "adjustment",
      description: "Immutable settlement",
      amountCents: 25000,
      externalReference: `immutable-${tenantId}`,
    });

    await settleFinancialEntry(tenantId, entry.id);

    const client = await pool.connect();
    try {
      await client.query("select set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      await assert.rejects(
        client.query(
          "update financial_entries set amount_cents = $1 where tenant_id = $2 and id = $3",
          [26000, tenantId, entry.id],
        ),
        /FINANCIAL_ENTRY_IMMUTABLE/,
      );
    } finally {
      client.release();
    }
  });

  it("defines freight-scoped assignment and trip foreign keys", async () => {
    const client = await adminPool.connect();
    try {
      const result = await client.query(
        `select conname, pg_get_constraintdef(oid) as definition
           from pg_constraint
          where conname in ('financial_entries_assignment_fk', 'financial_entries_trip_fk')
          order by conname`,
      );
      assert.equal(result.rows.length, 2);
      assert.match(
        result.rows[0].definition + result.rows[1].definition,
        /FOREIGN KEY \\(tenant_id, freight_id, assignment_id\\)/,
      );
      assert.match(
        result.rows[0].definition + result.rows[1].definition,
        /FOREIGN KEY \\(tenant_id, freight_id, trip_id\\)/,
      );
    } finally {
      client.release();
    }
  });
}
