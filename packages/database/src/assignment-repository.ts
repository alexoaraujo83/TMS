import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export interface FreightAssignmentRecord {
  id: string;
  tenantId: string;
  freightId: string;
  driverId: string;
  vehicleId: string;
  status: "active" | "completed" | "cancelled";
  assignedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentResult {
  assignment: FreightAssignmentRecord;
  freightStatus: string;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

const ASSIGNMENT_COLUMNS = `id,
  tenant_id as "tenantId",
  freight_id as "freightId",
  driver_id as "driverId",
  vehicle_id as "vehicleId",
  status,
  assigned_at as "assignedAt",
  completed_at as "completedAt",
  cancelled_at as "cancelledAt",
  created_at as "createdAt",
  updated_at as "updatedAt"`;

export class AssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async assign(
    tenantId: string,
    freightId: string,
    driverId: string,
    vehicleId: string,
    audit: AuditInput,
  ): Promise<AssignmentResult> {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");
    assertUuid(driverId, "driverId");
    assertUuid(vehicleId, "vehicleId");

    return withTransaction(this.pool, { tenantId }, async (client) => {
      const freightResult = await client.query<{ id: string; status: string }>(
        `select id, status from freights
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, freightId],
      );
      const freight = freightResult.rows[0];
      if (!freight) throw new Error("Freight not found");
      if (freight.status !== "matching") {
        throw new Error(
          `Freight status ${freight.status} is not eligible for assignment`,
        );
      }

      const driverResult = await client.query<{
        id: string;
        status: string;
        anttStatus: string;
      }>(
        `select id, status, antt_status as "anttStatus" from drivers
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, driverId],
      );
      const driver = driverResult.rows[0];
      if (!driver) throw new Error("Driver not found");
      if (driver.status !== "active" || driver.anttStatus !== "approved") {
        throw new Error("Driver is not eligible for assignment");
      }

      const vehicleResult = await client.query<{
        id: string;
        driverId: string | null;
        status: string;
      }>(
        `select id, driver_id as "driverId", status from vehicles
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, vehicleId],
      );
      const vehicle = vehicleResult.rows[0];
      if (!vehicle) throw new Error("Vehicle not found");
      if (vehicle.status !== "available") {
        throw new Error("Vehicle is not available for assignment");
      }
      if (vehicle.driverId !== driverId) {
        throw new Error("Vehicle is not assigned to the selected driver");
      }

      const existing = await client.query<{ id: string }>(
        `select id from freight_assignments
          where tenant_id = $1
            and status = 'active'
            and (freight_id = $2 or driver_id = $3 or vehicle_id = $4)
          limit 1`,
        [tenantId, freightId, driverId, vehicleId],
      );
      if (existing.rows[0]) {
        throw new Error(
          "Freight, driver, or vehicle already has an active assignment",
        );
      }

      const assignmentResult = await client.query<FreightAssignmentRecord>(
        `insert into freight_assignments (
          tenant_id, freight_id, driver_id, vehicle_id, status
        ) values ($1, $2, $3, $4, 'active')
        returning ${ASSIGNMENT_COLUMNS}`,
        [tenantId, freightId, driverId, vehicleId],
      );
      const assignment = assignmentResult.rows[0];
      if (!assignment) throw new Error("Assignment creation failed");

      const freightUpdate = await client.query<{ status: string }>(
        `update freights
            set status = 'assigned', updated_at = now()
          where tenant_id = $1 and id = $2 and status = 'matching'
          returning status`,
        [tenantId, freightId],
      );
      if (!freightUpdate.rows[0]) {
        throw new Error("Freight could not be moved to assigned");
      }

      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: assignment.id,
        afterState: {
          freightId,
          driverId,
          vehicleId,
          status: "active",
        },
      });

      return {
        assignment,
        freightStatus: freightUpdate.rows[0].status,
      };
    });
  }
}
