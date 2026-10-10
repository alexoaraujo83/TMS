import assert from "node:assert/strict";
import test from "node:test";
import { PostgresFreightRepository } from "../src/freight-repository.js";

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const freightId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const freight = {
  id: freightId, tenantId, status: "open", freightType: "dedicated",
  originCity: "Santos", originState: "SP", destinationCity: "São Paulo",
  destinationState: "SP", cargoDescription: "Carga", quantity: 1,
  weightKg: "100", volumeM3: "12", linearMeters: "4",
  customerPriceCents: "50000", driverPriceCents: "40000",
  vehicleTypes: [], bodyTypes: [], minimumFreeMeters: "2",
  minimumCapacityKg: "1000", createdAt: new Date(), updatedAt: new Date(),
};

test("freight PATCH distinguishes omitted nullable fields from explicit null", async () => {
  const statements: Array<{ sql: string; params: readonly unknown[] }> = [];
  const client = {
    query: async (sql: string, params: readonly unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes("select id,") && sql.includes("from freights where id = $1 and tenant_id = $2")) {
        return { rows: [{ ...freight }], rowCount: 1 };
      }
      if (sql.includes("update freights set")) {
        return { rows: [{ ...freight, volumeM3: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as never;
  const repository = new PostgresFreightRepository(pool);

  await repository.updateWithAudit(
    tenantId,
    freightId,
    { volumeM3: null },
    { action: "freight.updated", entityType: "freight" },
  );

  const update = statements.find((entry) => entry.sql.includes("update freights set"));
  assert.ok(update, "update statement should execute");
  assert.match(update.sql, /volume_m3 = case when \$19::boolean then \$11::numeric else volume_m3 end/);
  assert.equal(update.params[10], null, "explicit null is passed to SQL");
  assert.equal(update.params[18], true, "explicitly supplied field is marked present");
  assert.equal(update.params[19], false, "omitted field remains unchanged");
  assert.equal(update.params[20], false, "other omitted nullable fields remain unchanged");
});
