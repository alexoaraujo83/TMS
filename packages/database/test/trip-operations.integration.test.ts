import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { AssignmentRepository } from "../src/assignment-repository.js";
import { TripRepository } from "../src/trip-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("trip operations integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const assignments = new AssignmentRepository(pool);
  const trips = new TripRepository(pool);
  const tenantId = randomUUID();
  const userId = randomUUID();
  let carrierId = "";
  let driverId = "";
  let vehicleId = "";
  let freightId = "";
  let tripId = "";

  async function query<T>(text: string, values: readonly unknown[] = []) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query<T>(text, values);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  const audit = {
    actorUserId: userId,
    action: "test.trip_operations",
    entityType: "trip",
    requestId: randomUUID(),
  };

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
        "trips",
        "freight_assignments",
        "vehicles",
        "drivers",
        "carriers",
        "audit_events",
        "tenant_memberships",
        "users",
        "freights",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "insert into tenants (id, name, slug, status) values ($1, 'Trip Test', $2, 'active')",
        [tenantId, `trip-${tenantId}`],
      );
      await client.query(
        "insert into users (id, email, display_name, status) values ($1, $2, 'Trip Test', 'active')",
        [userId, `trip-${userId}@test.local`],
      );
      await client.query(
        "insert into tenant_memberships (user_id, tenant_id, role) values ($1, $2, 'operator')",
        [userId, tenantId],
      );
      carrierId = (
        await client.query<{ id: string }>(
          "insert into carriers (tenant_id, legal_name, document_number) values ($1, 'Trip Carrier', $2) returning id",
          [tenantId, `carrier-${tenantId}`],
        )
      ).rows[0].id;
      driverId = (
        await client.query<{ id: string }>(
          "insert into drivers (tenant_id, carrier_id, name, document_number, rntrc, antt_status, status) values ($1, $2, 'Trip Driver', $3, $4, 'approved', 'active') returning id",
          [tenantId, carrierId, `driver-${tenantId}`, `rntrc-${tenantId}`],
        )
      ).rows[0].id;
      vehicleId = (
        await client.query<{ id: string }>(
          "insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, status) values ($1, $2, 'TRP1A23', 'truck', 'aberto', 10000, 'available') returning id",
          [tenantId, driverId],
        )
      ).rows[0].id;
      freightId = (
        await client.query<{ id: string }>(
          "insert into freights (tenant_id, status, freight_type, origin_city, origin_state, destination_city, destination_state, cargo_description, quantity, weight_kg) values ($1, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis', 'MG', 'Trip cargo', 1, 1000) returning id",
          [tenantId],
        )
      ).rows[0].id;
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    for (const table of [
      "trips",
      "freight_assignments",
      "vehicles",
      "drivers",
      "carriers",
      "audit_events",
      "tenant_memberships",
      "users",
      "freights",
      "tenants",
    ]) {
      await query(`alter table ${table} enable row level security`);
      await query(`alter table ${table} force row level security`);
    }
    await assignments.assign(tenantId, freightId, driverId, vehicleId, {
      ...audit,
      entityType: "freight_assignment",
    });
    const trip = await trips.create(
      tenantId,
      freightId,
      (
        await query<{ id: string }>(
          "select id from freight_assignments where tenant_id = $1 and freight_id = $2",
          [tenantId, freightId],
        )
      ).rows[0].id,
      audit,
    );
    tripId = trip.id;
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "trips",
        "freight_assignments",
        "vehicles",
        "drivers",
        "carriers",
        "audit_events",
        "tenant_memberships",
        "users",
        "freights",
        "tenants",
      ])
        await client.query(`alter table ${table} disable row level security`);
      await client.query("delete from trips where tenant_id = $1", [tenantId]);
      await client.query(
        "delete from freight_assignments where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from audit_events where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from vehicles where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from drivers where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from carriers where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from freights where tenant_id = $1", [
        tenantId,
      ]);
      await client.query(
        "delete from tenant_memberships where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  describe("trip lifecycle", () => {
    it("moves assigned freight into transit and completes assignment on delivery", async () => {
      const started = await trips.transition(
        tenantId,
        tripId,
        "planned",
        "in_transit",
        audit,
      );
      assert.equal(started.status, "in_transit");
      const delivered = await trips.transition(
        tenantId,
        tripId,
        "in_transit",
        "delivered",
        audit,
      );
      assert.equal(delivered.status, "delivered");
      const state = await query<{
        freightStatus: string;
        assignmentStatus: string;
      }>(
        `select f.status as "freightStatus", a.status as "assignmentStatus"
           from freights f join freight_assignments a on a.tenant_id = f.tenant_id and a.freight_id = f.id
          where f.tenant_id = $1 and f.id = $2`,
        [tenantId, freightId],
      );
      assert.equal(state.rows[0].freightStatus, "delivered");
      assert.equal(state.rows[0].assignmentStatus, "completed");
    });

    it("rejects stale transitions", async () => {
      await assert.rejects(
        () =>
          trips.transition(tenantId, tripId, "planned", "in_transit", audit),
        /does not match expected status/,
      );
    });
  });
}
