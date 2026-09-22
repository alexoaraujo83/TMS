import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { AssignmentRepository } from "../src/assignment-repository.js";
import { PostgresFreightRepository } from "../src/freight-repository.js";
import { VehicleRepository } from "../src/operational-repositories.js";

const databaseUrl = process.env.DATABASE_URL;
const databaseAdminUrl = process.env.DATABASE_ADMIN_URL ?? databaseUrl;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("assignment lifecycle integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const adminPool = new Pool({ connectionString: databaseAdminUrl });
  const freightRepository = new PostgresFreightRepository(pool);
  const assignmentRepository = new AssignmentRepository(pool);
  const vehicleRepository = new VehicleRepository(pool);
  const tenantId = randomUUID();
  const userId = randomUUID();
  let driverId = "";
  let vehicleId = "";
  let carrierId = "";
  let deliveredFreightId = "";
  let cancelledFreightId = "";
  const audit = {
    actorUserId: userId,
    action: "test.assignment_lifecycle",
    entityType: "freight_assignment",
    requestId: randomUUID(),
  };

  async function tenantQuery<T>(text: string, values: readonly unknown[] = []) {
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

  async function insertFreight(status = "matching"): Promise<string> {
    const result = await tenantQuery<{ id: string }>(
      `insert into freights
        (tenant_id, status, freight_type, origin_city, origin_state,
         destination_city, destination_state, cargo_description, quantity, weight_kg)
       values ($1, $2, 'dedicated', 'Betim', 'MG', 'Divinopolis', 'MG', 'Test cargo', 1, 1000)
       returning id`,
      [tenantId, status],
    );
    return result.rows[0].id;
  }

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "freight_assignments",
        "vehicles",
        "drivers",
        "carriers",
        "audit_events",
        "outbox_events",
        "tenant_memberships",
        "users",
        "freights",
        "tenants",
      ]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        `insert into tenants (id, name, slug, status) values ($1, 'Assignment Test', $2, 'active')`,
        [tenantId, `assignment-${tenantId}`],
      );
      await client.query(
        `insert into users (id, email, display_name, status) values ($1, $2, 'Assignment Test', 'active')`,
        [userId, `assignment-${userId}@test.local`],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role) values ($1, $2, 'operator')`,
        [userId, tenantId],
      );
      carrierId = (
        await client.query<{ id: string }>(
          `insert into carriers (tenant_id, legal_name, document_number) values ($1, 'Assignment Carrier', $2) returning id`,
          [tenantId, `carrier-${tenantId}`],
        )
      ).rows[0].id;
      driverId = (
        await client.query<{ id: string }>(
          `insert into drivers (tenant_id, carrier_id, name, document_number, rntrc, antt_status, status)
         values ($1, $2, 'Assignment Driver', $3, $4, 'approved', 'active') returning id`,
          [tenantId, carrierId, `driver-${tenantId}`, `rntrc-${tenantId}`],
        )
      ).rows[0].id;
      vehicleId = (
        await client.query<{ id: string }>(
          `insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, status)
         values ($1, $2, 'ABC1D23', 'truck', 'open', 10000, 'available') returning id`,
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

    const enableClient = await adminPool.connect();
    try {
      await enableClient.query("begin");
      for (const table of [
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
        await enableClient.query(
          `alter table ${table} enable row level security`,
        );
        await enableClient.query(
          `alter table ${table} force row level security`,
        );
      }
      await enableClient.query("commit");
    } finally {
      enableClient.release();
    }

    deliveredFreightId = await insertFreight();
    await assignmentRepository.assign(
      tenantId,
      deliveredFreightId,
      driverId,
      vehicleId,
      audit,
    );
    cancelledFreightId = await insertFreight();
  });

  after(async () => {
    const client = await adminPool.connect();
    try {
      await client.query("begin");
      for (const table of [
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
        "delete from freight_assignments where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from audit_events where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from outbox_events where tenant_id = $1", [
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
      await client.query(
        "delete from tenant_memberships where tenant_id = $1",
        [tenantId],
      );
      await client.query("delete from freights where tenant_id = $1", [
        tenantId,
      ]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await adminPool.end();
      await pool.end();
    }
  });

  describe("assignment lifecycle synchronization", () => {
    it("completes the assignment when freight is delivered", async () => {
      await freightRepository.updateStatusWithAudit(
        tenantId,
        deliveredFreightId,
        "assigned",
        "in_transit",
        audit,
      );
      const delivered = await freightRepository.updateStatusWithAudit(
        tenantId,
        deliveredFreightId,
        "in_transit",
        "delivered",
        audit,
      );
      assert.equal(delivered?.status, "delivered");

      const outbox = await tenantQuery<{
        eventType: string;
        aggregateType: string;
        aggregateId: string;
        payload: { freight_id?: string; to_status?: string };
      }>(
        `select event_type as "eventType", aggregate_type as "aggregateType",
                aggregate_id as "aggregateId", payload
           from outbox_events
          where tenant_id = $1 and aggregate_id = $2
          order by created_at desc limit 1`,
        [tenantId, deliveredFreightId],
      );
      assert.equal(outbox.rows[0]?.eventType, "freight.status_changed");
      assert.equal(outbox.rows[0]?.aggregateType, "freight");
      assert.equal(outbox.rows[0]?.aggregateId, deliveredFreightId);
      assert.equal(outbox.rows[0]?.payload.freight_id, deliveredFreightId);
      assert.equal(outbox.rows[0]?.payload.to_status, "delivered");

      const result = await tenantQuery<{
        status: string;
        completedAt: Date | null;
        cancelledAt: Date | null;
      }>(
        `select status, completed_at as "completedAt", cancelled_at as "cancelledAt"
           from freight_assignments where tenant_id = $1 and freight_id = $2`,
        [tenantId, deliveredFreightId],
      );
      const assignment = result.rows[0];
      assert.equal(assignment?.status, "completed");
      assert.ok(assignment?.completedAt);
      assert.equal(assignment?.cancelledAt, null);
    });

    it("rejects delivery without an assignment and rolls back the freight update", async () => {
      const freightId = await insertFreight("in_transit");

      await assert.rejects(
        freightRepository.updateStatusWithAudit(
          tenantId,
          freightId,
          "in_transit",
          "delivered",
          audit,
        ),
        /Freight cannot be delivered without an active assignment/,
      );
      const freight = await freightRepository.findById(tenantId, freightId);
      assert.equal(freight?.status, "in_transit");
    });

    it("cancels the assignment when freight is cancelled", async () => {
      await assignmentRepository.assign(
        tenantId,
        cancelledFreightId,
        driverId,
        vehicleId,
        audit,
      );
      const cancelled = await freightRepository.updateStatusWithAudit(
        tenantId,
        cancelledFreightId,
        "assigned",
        "cancelled",
        audit,
      );
      assert.equal(cancelled?.status, "cancelled");

      const result = await tenantQuery<{
        status: string;
        cancelledAt: Date | null;
        completedAt: Date | null;
      }>(
        `select status, cancelled_at as "cancelledAt", completed_at as "completedAt"
           from freight_assignments where tenant_id = $1 and freight_id = $2`,
        [tenantId, cancelledFreightId],
      );
      const assignment = result.rows[0];
      assert.equal(assignment?.status, "cancelled");
      assert.ok(assignment?.cancelledAt);
      assert.equal(assignment?.completedAt, null);
    });

    it("excludes an actively assigned driver from matching", async () => {
      const freightId = await insertFreight();
      const candidatesBefore = await vehicleRepository.findMatchingCandidates(
        tenantId,
        ["truck"],
        ["open"],
        1000,
      );
      assert.equal(
        candidatesBefore.some((candidate) => candidate.driverId === driverId),
        true,
      );

      await assignmentRepository.assign(
        tenantId,
        freightId,
        driverId,
        vehicleId,
        audit,
      );
      const candidatesAfter = await vehicleRepository.findMatchingCandidates(
        tenantId,
        ["truck"],
        ["open"],
        1000,
      );
      assert.equal(
        candidatesAfter.some((candidate) => candidate.driverId === driverId),
        false,
      );
    });

    it("allows only one of two concurrent assignments for the same driver and vehicle", async () => {
      const freightA = await insertFreight();
      const freightB = await insertFreight();
      const results = await Promise.allSettled([
        assignmentRepository.assign(
          tenantId,
          freightA,
          driverId,
          vehicleId,
          audit,
        ),
        assignmentRepository.assign(
          tenantId,
          freightB,
          driverId,
          vehicleId,
          audit,
        ),
      ]);

      assert.equal(
        results.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        results.filter((result) => result.status === "rejected").length,
        1,
      );

      const active = await tenantQuery<{ freightId: string }>(
        `select freight_id as "freightId" from freight_assignments
          where tenant_id = $1 and status = 'active' and driver_id = $2`,
        [tenantId, driverId],
      );
      assert.equal(active.rows.length, 1);
    });
  });
}
