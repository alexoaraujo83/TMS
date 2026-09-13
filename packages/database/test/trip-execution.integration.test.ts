import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { AssignmentRepository } from "../src/assignment-repository.js";
import { TripExecutionRepository } from "../src/trip-execution-repository.js";
import { TripRepository } from "../src/trip-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled = process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("trip execution integration", () => {
    it("is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured", () => {});
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const assignments = new AssignmentRepository(pool);
  const trips = new TripRepository(pool);
  const execution = new TripExecutionRepository(pool);
  const tenantId = randomUUID();
  const userId = randomUUID();
  let freightId = "";
  let tripId = "";

  async function query<T>(text: string, values: readonly unknown[] = []) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantId]);
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
    action: "test.trip_execution",
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
        "trip_pods",
        "trip_occurrences",
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
        "insert into tenants (id, name, slug, status) values ($1, 'Execution Test', $2, 'active')",
        [tenantId, `execution-${tenantId}`],
      );
      await client.query(
        "insert into users (id, email, display_name, status) values ($1, $2, 'Execution Test', 'active')",
        [userId, `execution-${userId}@test.local`],
      );
      await client.query(
        "insert into tenant_memberships (user_id, tenant_id, role) values ($1, $2, 'operator')",
        [userId, tenantId],
      );
      const carrierId = (
        await client.query<{ id: string }>(
          "insert into carriers (tenant_id, legal_name, document_number) values ($1, 'Execution Carrier', $2) returning id",
          [tenantId, `carrier-${tenantId}`],
        )
      ).rows[0].id;
      const driverId = (
        await client.query<{ id: string }>(
          "insert into drivers (tenant_id, carrier_id, name, document_number, rntrc, antt_status, status) values ($1, $2, 'Execution Driver', $3, $4, 'approved', 'active') returning id",
          [tenantId, carrierId, `driver-${tenantId}`, `rntrc-${tenantId}`],
        )
      ).rows[0].id;
      const vehicleId = (
        await client.query<{ id: string }>(
          "insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, status) values ($1, $2, 'EXE1A23', 'truck', 'aberto', 10000, 'available') returning id",
          [tenantId, driverId],
        )
      ).rows[0].id;
      freightId = (
        await client.query<{ id: string }>(
          "insert into freights (tenant_id, status, freight_type, origin_city, origin_state, destination_city, destination_state, cargo_description, quantity, weight_kg) values ($1, 'matching', 'dedicated', 'Betim', 'MG', 'Santos', 'SP', 'Execution cargo', 1, 1000) returning id",
          [tenantId],
        )
      ).rows[0].id;
      await client.query("commit");
      await query("alter table trips enable row level security");
      await query("alter table trips force row level security");
      await query("alter table freight_assignments enable row level security");
      await query("alter table freight_assignments force row level security");
      await assignments.assign(tenantId, freightId, driverId, vehicleId, {
        ...audit,
        entityType: "freight_assignment",
      });
      const assignmentId = (
        await query<{ id: string }>(
          "select id from freight_assignments where tenant_id = $1 and freight_id = $2",
          [tenantId, freightId],
        )
      ).rows[0].id;
      tripId = (await trips.create(tenantId, freightId, assignmentId, audit)).id;
    } finally {
      client.release();
    }
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of [
        "trip_pods",
        "trip_occurrences",
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
      await client.query("delete from tenants where id = $1", [tenantId]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("records an occurrence and exposes it in the operational timeline", async () => {
    const occurrence = await execution.createOccurrence(
      tenantId,
      tripId,
      {
        type: "delay",
        severity: "warning",
        description: "Traffic delay",
      },
      audit,
    );
    assert.equal(occurrence.tripId, tripId);
    const timeline = await execution.listTimeline(tenantId, tripId);
    assert.ok(
      timeline.some(
        (event) =>
          event.type === "trip.occurrence" && event.entityId === occurrence.id,
      ),
    );
  });

  it("requires delivery before POD and allows exactly one POD", async () => {
    await assert.rejects(
      () =>
        execution.createPod(
          tenantId,
          tripId,
          {
            recipientName: "Receiver",
            receivedAt: new Date(),
            documentRef: "s3://test/pod.pdf",
          },
          audit,
        ),
      /POD requires a delivered trip/,
    );
    await trips.transition(tenantId, tripId, "planned", "in_transit", audit);
    await trips.transition(tenantId, tripId, "in_transit", "delivered", audit);
    const pod = await execution.createPod(
      tenantId,
      tripId,
      {
        recipientName: "Receiver",
        receivedAt: new Date(),
        documentRef: "s3://test/pod.pdf",
      },
      audit,
    );
    assert.equal((await execution.getPod(tenantId, tripId))?.id, pod.id);
    await assert.rejects(
      () =>
        execution.createPod(
          tenantId,
          tripId,
          {
            recipientName: "Receiver 2",
            receivedAt: new Date(),
            documentRef: "s3://test/pod-2.pdf",
          },
          audit,
        ),
      /POD already exists for trip/,
    );
    const timeline = await execution.listTimeline(tenantId, tripId);
    assert.ok(
      timeline.some(
        (event) => event.type === "trip.pod" && event.entityId === pod.id,
      ),
    );
  });
}
