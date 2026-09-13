import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { AssignmentRepository } from "../src/assignment-repository.js";
import { MatchingCandidateRepository } from "../src/matching-candidate-repository.js";

const databaseUrl = process.env.DATABASE_URL;
const enabled =
  process.env.RUN_DB_INTEGRATION === "true" && Boolean(databaseUrl);

if (!enabled) {
  describe("assignment matching eligibility integration", () => {
    it(
      "is disabled unless RUN_DB_INTEGRATION=true and DATABASE_URL is configured",
      () => {},
    );
  });
} else {
  const pool = new Pool({ connectionString: databaseUrl });
  const assignments = new AssignmentRepository(pool);
  const candidates = new MatchingCandidateRepository(pool);
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const userId = randomUUID();
  const otherUserId = randomUUID();
  const driverId = randomUUID();
  const carrierId = randomUUID();
  const otherDriverId = randomUUID();
  const otherCarrierId = randomUUID();
  const freightId = randomUUID();
  const wrongVehicleId = randomUUID();
  const otherVehicleId = randomUUID();
  const matchedVehicleId = randomUUID();
  const unavailableVehicleId = randomUUID();
  const audit = {
    actorUserId: userId,
    action: "test.assignment_matching_eligibility",
    entityType: "freight_assignment",
    requestId: randomUUID(),
  };
  const tables = [
    "freight_assignments",
    "vehicles",
    "drivers",
    "carriers",
    "audit_events",
    "tenant_memberships",
    "users",
    "freights",
    "tenants",
  ];

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

  before(async () => {
    execFileSync("pnpm", ["migrate"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of tables) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        `insert into tenants (id, name, slug, status)
         values ($1, 'Assignment Eligibility', $2, 'active'),
                ($3, 'Other Tenant', $4, 'active')`,
        [
          tenantId,
          `assignment-eligibility-${tenantId}`,
          otherTenantId,
          `assignment-other-${otherTenantId}`,
        ],
      );
      await client.query(
        `insert into users (id, email, display_name, status)
         values ($1, $2, 'Assignment User', 'active'),
                ($3, $4, 'Other User', 'active')`,
        [
          userId,
          `assignment-${userId}@test.local`,
          otherUserId,
          `assignment-${otherUserId}@test.local`,
        ],
      );
      await client.query(
        `insert into tenant_memberships (user_id, tenant_id, role)
         values ($1, $2, 'operator'), ($3, $4, 'operator')`,
        [userId, tenantId, otherUserId, otherTenantId],
      );
      await client.query(
        `insert into carriers (id, tenant_id, legal_name, document_number)
         values ($1, $2, 'Assignment Carrier', $3),
                ($4, $5, 'Other Carrier', $6)`,
        [
          carrierId,
          tenantId,
          `carrier-${tenantId}`,
          otherCarrierId,
          otherTenantId,
          `carrier-${otherTenantId}`,
        ],
      );
      await client.query(
        `insert into drivers (
           id, tenant_id, carrier_id, name, document_number, rntrc,
           antt_status, status
         ) values
           ($1, $2, $3, 'Assignment Driver', $4, $5, 'approved', 'active'),
           ($6, $7, $8, 'Other Driver', $9, $10, 'approved', 'active')`,
        [
          driverId,
          tenantId,
          carrierId,
          `driver-${tenantId}`,
          `rntrc-${tenantId}`,
          otherDriverId,
          otherTenantId,
          otherCarrierId,
          `driver-${otherTenantId}`,
          `rntrc-${otherTenantId}`,
        ],
      );
      await client.query(
        `insert into vehicles (
           id, tenant_id, driver_id, plate, vehicle_type, body_type,
           capacity_kg, free_meters, status
         ) values
           ($1, $2, $3, 'MATCH123', 'truck', 'open', 10000, 10, 'available'),
           ($4, $5, $6, 'WRONG123', 'truck', 'closed', 10000, 10, 'available'),
           ($7, $8, $9, 'OTHER123', 'truck', 'open', 10000, 10, 'available'),
           ($10, $11, $12, 'BUSY123', 'truck', 'open', 10000, 10, 'maintenance')`,
        [
          matchedVehicleId,
          tenantId,
          driverId,
          wrongVehicleId,
          tenantId,
          driverId,
          otherVehicleId,
          otherTenantId,
          otherDriverId,
          unavailableVehicleId,
          tenantId,
          driverId,
        ],
      );
      await client.query(
        `insert into freights (
           id, tenant_id, status, freight_type, origin_city, origin_state,
           destination_city, destination_state, cargo_description, quantity,
           weight_kg, vehicle_types, body_types, minimum_free_meters,
           minimum_capacity_kg
         ) values (
           $1, $2, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis',
           'MG', 'Assignment eligibility cargo', 1, 5000,
           ARRAY['truck'], ARRAY['open'], 5, 5000
         )`,
        [freightId, tenantId],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const enableClient = await pool.connect();
    try {
      await enableClient.query("begin");
      for (const table of tables) {
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
  });

  after(async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      for (const table of tables) {
        await client.query(`alter table ${table} disable row level security`);
      }
      await client.query(
        "delete from freight_assignments where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from audit_events where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from vehicles where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from drivers where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from carriers where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from tenant_memberships where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query(
        "delete from freights where tenant_id in ($1, $2)",
        [tenantId, otherTenantId],
      );
      await client.query("delete from users where id in ($1, $2)", [
        userId,
        otherUserId,
      ]);
      await client.query("delete from tenants where id in ($1, $2)", [
        tenantId,
        otherTenantId,
      ]);
      await client.query("commit");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("assigns the exact vehicle returned by matching", async () => {
    const ranked = await candidates.findAvailable(
      tenantId,
      ["truck"],
      ["open"],
      5000,
      5,
    );
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]?.vehicleId, matchedVehicleId);

    const result = await assignments.assign(
      tenantId,
      freightId,
      driverId,
      ranked[0]!.vehicleId,
      audit,
    );
    assert.equal(result.assignment.vehicleId, matchedVehicleId);
    assert.equal(result.freightStatus, "assigned");
  });

  it(
    "rejects a different vehicle for the same driver when it violates freight requirements",
    async () => {
      const freshFreightId = randomUUID();
      await query(
        `insert into freights (
           id, tenant_id, status, freight_type, origin_city, origin_state,
           destination_city, destination_state, cargo_description, quantity,
           weight_kg, vehicle_types, body_types, minimum_free_meters,
           minimum_capacity_kg
         ) values (
           $1, $2, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis',
           'MG', 'Wrong vehicle cargo', 1, 5000,
           ARRAY['truck'], ARRAY['open'], 5, 5000
         )`,
        [freshFreightId, tenantId],
      );

      await assert.rejects(
        assignments.assign(
          tenantId,
          freshFreightId,
          driverId,
          wrongVehicleId,
          audit,
        ),
        /Vehicle does not satisfy freight matching requirements/,
      );

      const state = await query<{ status: string; assignments: string }>(
        `select f.status, count(fa.id)::text as assignments
           from freights f
           left join freight_assignments fa
             on fa.freight_id = f.id and fa.status = 'active'
          where f.tenant_id = $1 and f.id = $2
          group by f.status`,
        [tenantId, freshFreightId],
      );
      assert.equal(state.rows[0]?.status, "matching");
      assert.equal(state.rows[0]?.assignments, "0");
    },
  );

  it("rejects a vehicle from another tenant", async () => {
    const freshFreightId = randomUUID();
    await query(
      `insert into freights (
         id, tenant_id, status, freight_type, origin_city, origin_state,
         destination_city, destination_state, cargo_description, quantity,
         weight_kg
       ) values (
         $1, $2, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis',
         'MG', 'Cross tenant cargo', 1, 1000
       )`,
      [freshFreightId, tenantId],
    );
    await assert.rejects(
      assignments.assign(
        tenantId,
        freshFreightId,
        driverId,
        otherVehicleId,
        audit,
      ),
      /Vehicle not found/,
    );
  });

  it("rejects an unavailable vehicle before creating an assignment", async () => {
    const freshFreightId = randomUUID();
    await query(
      `insert into freights (
         id, tenant_id, status, freight_type, origin_city, origin_state,
         destination_city, destination_state, cargo_description, quantity,
         weight_kg
       ) values (
         $1, $2, 'matching', 'dedicated', 'Betim', 'MG', 'Divinopolis',
         'MG', 'Unavailable cargo', 1, 1000
       )`,
      [freshFreightId, tenantId],
    );
    await assert.rejects(
      assignments.assign(
        tenantId,
        freshFreightId,
        driverId,
        unavailableVehicleId,
        audit,
      ),
      /Vehicle is not available for assignment/,
    );
  });
}
