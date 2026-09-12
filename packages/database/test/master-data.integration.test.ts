import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after, before, describe, it } from "node:test";

const databaseUrl = process.env.DATABASE_URL;
const runIntegration =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!runIntegration) {
  describe("master data relationship integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  let carrierA: string;
  let driverA: string;
  let vehicleA: string;

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
         values ($1, 'Master Data A', $3, 'active'),
                ($2, 'Master Data B', $4, 'active')`,
        [tenantA, tenantB, `master-a-${tenantA}`, `master-b-${tenantB}`],
      );
      await client.query(
        `insert into users (id, email, display_name, status)
         values ($1, $3, 'Master User A', 'active'),
                ($2, $4, 'Master User B', 'active')`,
        [userA, userB, `master-a-${userA}@test.local`, `master-b-${userB}@test.local`],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role)
         values ($1, $2, 'operator'), ($3, $4, 'operator')`,
        [userA, tenantA, userB, tenantB],
      );

      const carrier = await client.query<{ id: string }>(
        `insert into carriers (tenant_id, legal_name, document_number)
         values ($1, 'Carrier A', $2)
         returning id`,
        [tenantA, `carrier-${tenantA}`],
      );
      carrierA = carrier.rows[0].id;

      const driver = await client.query<{ id: string }>(
        `insert into drivers (tenant_id, carrier_id, name, document_number, rntrc)
         values ($1, $2, 'Driver A', $3, $4)
         returning id`,
        [tenantA, carrierA, `driver-${tenantA}`, `rntrc-${tenantA}`],
      );
      driverA = driver.rows[0].id;

      const vehicle = await client.query<{ id: string }>(
        `insert into vehicles
           (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg)
         values ($1, $2, 'ABC1D23', 'truck', 'open', 10000)
         returning id`,
        [tenantA, driverA],
      );
      vehicleA = vehicle.rows[0].id;

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
        "vehicles",
        "drivers",
        "carriers",
        "tenant_memberships",
        "users",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from vehicles where tenant_id in ($1, $2)", [
        tenantA,
        tenantB,
      ]);
      await client.query("delete from drivers where tenant_id in ($1, $2)", [
        tenantA,
        tenantB,
      ]);
      await client.query("delete from carriers where tenant_id in ($1, $2)", [
        tenantA,
        tenantB,
      ]);
      await client.query(
        "delete from tenant_memberships where tenant_id in ($1, $2)",
        [tenantA, tenantB],
      );
      await client.query("delete from users where id in ($1, $2)", [
        userA,
        userB,
      ]);
      await client.query("delete from tenants where id in ($1, $2)", [
        tenantA,
        tenantB,
      ]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  describe("same-tenant relationship constraints", () => {
    it("accepts carrier -> driver -> vehicle relationships within one tenant", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query(
          `select c.tenant_id as "carrierTenant", d.tenant_id as "driverTenant",
                  d.carrier_id as "carrierId", v.driver_id as "driverId"
             from carriers c
             join drivers d on d.tenant_id = c.tenant_id and d.carrier_id = c.id
             join vehicles v on v.tenant_id = d.tenant_id and v.driver_id = d.id
            where c.id = $1 and d.id = $2 and v.id = $3`,
          [carrierA, driverA, vehicleA],
        );
        await client.query("rollback");

        const row = result.rows[0];
        if (!row || row.carrierTenant !== tenantA || row.driverTenant !== tenantA) {
          throw new Error("same-tenant master data relationship is invalid");
        }
      } finally {
        client.release();
      }
    });
  });

  describe("cross-tenant relationship constraints", () => {
    it("rejects a driver from one tenant referencing a carrier from another", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `insert into drivers (tenant_id, carrier_id, name, document_number, rntrc)
           values ($1, $2, 'Cross Tenant Driver', $3, $4)`,
          [tenantB, carrierA, `cross-driver-${tenantB}`, `cross-rntrc-${tenantB}`],
        );
        await client.query("rollback");
        throw new Error("cross-tenant driver -> carrier relationship was accepted");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (!(error instanceof Error) || !error.message.includes("violates foreign key constraint")) {
          throw error;
        }
      } finally {
        client.release();
      }
    });

    it("rejects a vehicle from one tenant referencing a driver from another", async () => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          `insert into vehicles
             (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg)
           values ($1, $2, 'XYZ9Z99', 'truck', 'open', 10000)`,
          [tenantB, driverA],
        );
        await client.query("rollback");
        throw new Error("cross-tenant vehicle -> driver relationship was accepted");
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        if (!(error instanceof Error) || !error.message.includes("violates foreign key constraint")) {
          throw error;
        }
      } finally {
        client.release();
      }
    });
  });
}
