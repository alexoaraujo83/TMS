import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { after, before, describe, it } from "node:test";
import { AssignmentRepository } from "../src/assignment-repository.js";
import { PostgresFreightRepository } from "../src/freight-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled = process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("assignment lifecycle integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const freightRepository = new PostgresFreightRepository(pool);
  const assignmentRepository = new AssignmentRepository(pool);
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

  async function insertFreight(): Promise<string> {
    const client = await pool.connect();
    try {
      const result = await client.query<{ id: string }>(
        `insert into freights
          (tenant_id, status, freight_type, origin_city, origin_state,
           destination_city, destination_state, cargo_description, quantity, weight_kg)
         values ($1, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis', 'MG', 'Test cargo', 1, 1000)
         returning id`,
        [tenantId],
      );
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  before(async () => {
    execFileSync("pnpm", ["migrate"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of ["freight_assignments", "vehicles", "drivers", "carriers", "audit_events", "tenant_memberships", "users", "freights", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(`insert into tenants (id, name, slug, status) values ($1, 'Assignment Test', $2, 'active')`, [tenantId, `assignment-${tenantId}`]);
      await client.query(`insert into users (id, email, display_name, status) values ($1, $2, 'Assignment Test', 'active')`, [userId, `assignment-${userId}@test.local`]);
      await client.query(`insert into tenant_memberships (user_id, tenant_id, role) values ($1, $2, 'operator')`, [userId, tenantId]);
      carrierId = (await client.query<{ id: string }>(
        `insert into carriers (tenant_id, legal_name, document_number) values ($1, 'Assignment Carrier', $2) returning id`,
        [tenantId, `carrier-${tenantId}`],
      )).rows[0].id;
      driverId = (await client.query<{ id: string }>(
        `insert into drivers (tenant_id, carrier_id, name, document_number, rntrc, antt_status, status)
         values ($1, $2, 'Assignment Driver', $3, $4, 'approved', 'active') returning id`,
        [tenantId, carrierId, `driver-${tenantId}`, `rntrc-${tenantId}`],
      )).rows[0].id;
      vehicleId = (await client.query<{ id: string }>(
        `insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, status)
         values ($1, $2, 'ABC1D23', 'truck', 'open', 10000, 'available') returning id`,
        [tenantId, driverId],
      )).rows[0].id;
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    deliveredFreightId = await insertFreight();
    await assignmentRepository.assign(tenantId, deliveredFreightId, driverId, vehicleId, audit);
    cancelledFreightId = await insertFreight();
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of ["freight_assignments", "vehicles", "drivers", "carriers", "audit_events", "tenant_memberships", "users", "freights", "tenants"]) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query("delete from freight_assignments where tenant_id = $1", [tenantId]);
      await client.query("delete from audit_events where tenant_id = $1", [tenantId]);
      await client.query("delete from vehicles where tenant_id = $1", [tenantId]);
      await client.query("delete from drivers where tenant_id = $1", [tenantId]);
      await client.query("delete from carriers where tenant_id = $1", [tenantId]);
      await client.query("delete from tenant_memberships where tenant_id = $1", [tenantId]);
      await client.query("delete from freights where tenant_id = $1", [tenantId]);
      await client.query("delete from users where id = $1", [userId]);
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  describe("assignment lifecycle synchronization", () => {
    it("completes the assignment when freight is delivered", async () => {
      await freightRepository.updateStatusWithAudit(tenantId, deliveredFreightId, "assigned", "in_transit", audit);
      const delivered = await freightRepository.updateStatusWithAudit(tenantId, deliveredFreightId, "in_transit", "delivered", audit);
      if (delivered?.status !== "delivered") throw new Error("freight did not reach delivered");

      const result = await pool.query<{ status: string; completedAt: Date | null; cancelledAt: Date | null }>(
        `select status, completed_at as "completedAt", cancelled_at as "cancelledAt"
           from freight_assignments where tenant_id = $1 and freight_id = $2`,
        [tenantId, deliveredFreightId],
      );
      const assignment = result.rows[0];
      if (!assignment || assignment.status !== "completed" || !assignment.completedAt || assignment.cancelledAt) {
        throw new Error("assignment was not completed with freight delivery");
      }
    });

    it("rejects delivery without an assignment and rolls back the freight update", async () => {
      const freightId = await insertFreight();
      await pool.query(`update freights set status = 'in_transit', updated_at = now() where tenant_id = $1 and id = $2`, [tenantId, freightId]);

      await assertRejects(
        freightRepository.updateStatusWithAudit(tenantId, freightId, "in_transit", "delivered", audit),
        "Freight cannot be delivered without an active assignment",
      );
      const freight = await freightRepository.findById(tenantId, freightId);
      if (freight?.status !== "in_transit") throw new Error("delivery failure did not roll back freight state");
    });

    it("cancels the assignment when freight is cancelled", async () => {
      await assignmentRepository.assign(tenantId, cancelledFreightId, driverId, vehicleId, audit);
      const cancelled = await freightRepository.updateStatusWithAudit(tenantId, cancelledFreightId, "assigned", "cancelled", audit);
      if (cancelled?.status !== "cancelled") throw new Error("freight did not reach cancelled");

      const result = await pool.query<{ status: string; cancelledAt: Date | null; completedAt: Date | null }>(
        `select status, cancelled_at as "cancelledAt", completed_at as "completedAt"
           from freight_assignments where tenant_id = $1 and freight_id = $2`,
        [tenantId, cancelledFreightId],
      );
      const assignment = result.rows[0];
      if (!assignment || assignment.status !== "cancelled" || !assignment.cancelledAt || assignment.completedAt) {
        throw new Error("assignment was not cancelled with freight cancellation");
      }
    });
  });
}

async function assertRejects(promise: Promise<unknown>, expectedMessage: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error(`Expected rejection: ${expectedMessage}`);
}
