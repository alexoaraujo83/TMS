import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { VehicleRepository } from "../src/operational-repositories.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("matching carrier eligibility integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const vehicleRepository = new VehicleRepository(pool);
  const tenantId = randomUUID();
  const userId = randomUUID();
  let carrierId = "";
  let driverId = "";
  let vehicleId = "";

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
        "freight_assignments",
        "vehicles",
        "drivers",
        "carriers",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }

      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'Matching Carrier Test', $2, 'active')`,
        [tenantId, `matching-carrier-${tenantId}`],
      );
      await client.query(
        `insert into users (id, email, display_name, status)
         values ($1, $2, 'Matching Carrier Test', 'active')`,
        [userId, `matching-carrier-${userId}@test.local`],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role)
         values ($1, $2, 'operator')`,
        [userId, tenantId],
      );
      carrierId = (
        await client.query<{ id: string }>(
          `insert into carriers (tenant_id, legal_name, document_number, status)
           values ($1, 'Inactive Carrier', $2, 'inactive') returning id`,
          [tenantId, `carrier-${tenantId}`],
        )
      ).rows[0].id;
      driverId = (
        await client.query<{ id: string }>(
          `insert into drivers
             (tenant_id, carrier_id, name, document_number, rntrc, antt_status, status)
           values ($1, $2, 'Matching Driver', $3, $4, 'approved', 'active') returning id`,
          [tenantId, carrierId, `driver-${tenantId}`, `rntrc-${tenantId}`],
        )
      ).rows[0].id;
      vehicleId = (
        await client.query<{ id: string }>(
          `insert into vehicles
             (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, status)
           values ($1, $2, 'MCH1D23', 'truck', 'open', 10000, 'available') returning id`,
          [tenantId, driverId],
        )
      ).rows[0].id;
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
        "freight_assignments",
        "vehicles",
        "drivers",
        "carriers",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from vehicles where id = $1", [vehicleId]);
      await client.query("delete from drivers where id = $1", [driverId]);
      await client.query("delete from carriers where id = $1", [carrierId]);
      await client.query("delete from tenant_memberships where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  describe("carrier status eligibility", () => {
    it("excludes a driver linked to an inactive carrier from matching", async () => {
      const inactiveCandidates =
        await vehicleRepository.findMatchingCandidates(
          tenantId,
          ["truck"],
          ["open"],
          1000,
        );
      assert.equal(
        inactiveCandidates.some((candidate) => candidate.driverId === driverId),
        false,
      );

      await tenantUpdateCarrierStatus("active");

      const activeCandidates =
        await vehicleRepository.findMatchingCandidates(
          tenantId,
          ["truck"],
          ["open"],
          1000,
        );
      assert.equal(
        activeCandidates.some((candidate) => candidate.driverId === driverId),
        true,
      );
    });
  });

  async function tenantUpdateCarrierStatus(status: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      await client.query(
        "update carriers set status = $1 where tenant_id = $2 and id = $3",
        [status, tenantId, carrierId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}
