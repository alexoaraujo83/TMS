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

export interface AssignmentVehicleRequirements {
  vehicleTypes: readonly string[];
  bodyTypes: readonly string[];
  weightKg: number;
  minimumCapacityKg: number | null;
  minimumFreeMeters: number | null;
}

export interface AssignmentVehicleSnapshot {
  vehicleType: string;
  bodyType: string;
  capacityKg: number;
  freeMeters: number | null;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

export function vehicleSatisfiesFreightRequirements(
  freight: AssignmentVehicleRequirements,
  vehicle: AssignmentVehicleSnapshot,
): boolean {
  const requiredCapacityKg = Math.max(
    freight.weightKg,
    freight.minimumCapacityKg ?? 0,
  );
  const vehicleTypeMatches =
    freight.vehicleTypes.length === 0 ||
    freight.vehicleTypes.includes(vehicle.vehicleType);
  const bodyTypeMatches =
    freight.bodyTypes.length === 0 ||
    freight.bodyTypes.includes(vehicle.bodyType);
  const freeMetersMatches =
    freight.minimumFreeMeters === null ||
    (vehicle.freeMeters !== null &&
      vehicle.freeMeters >= freight.minimumFreeMeters);

  return (
    vehicleTypeMatches &&
    bodyTypeMatches &&
    vehicle.capacityKg >= requiredCapacityKg &&
    freeMetersMatches
  );
}

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
      const freightResult = await client.query<{
        id: string;
        status: string;
        weightKg: string;
        vehicleTypes: readonly string[];
        bodyTypes: readonly string[];
        minimumFreeMeters: string | null;
        minimumCapacityKg: string | null;
      }>(
        `select id, status, weight_kg as "weightKg",
                vehicle_types as "vehicleTypes", body_types as "bodyTypes",
                minimum_free_meters as "minimumFreeMeters",
                minimum_capacity_kg as "minimumCapacityKg"
           from freights
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, freightId],
      );
      const freight = freightResult.rows[0];
      if (!freight) throw new Error("Freight not found");
      if (freight.status !== "matching" && freight.status !== "negotiating") {
        throw new Error(
          `Freight status ${freight.status} is not eligible for assignment`,
        );
      }

      const driverResult = await client.query<{
        id: string;
        carrierId: string | null;
        status: string;
        anttStatus: string;
      }>(
        `select id, carrier_id as "carrierId", status,
                antt_status as "anttStatus"
           from drivers
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, driverId],
      );
      const driver = driverResult.rows[0];
      if (!driver) throw new Error("Driver not found");
      if (driver.status !== "active" || driver.anttStatus !== "approved") {
        throw new Error("Driver is not eligible for assignment");
      }

      if (driver.carrierId) {
        const carrierResult = await client.query<{ status: string }>(
          `select status from carriers
            where tenant_id = $1 and id = $2
            for update`,
          [tenantId, driver.carrierId],
        );
        const carrier = carrierResult.rows[0];
        if (!carrier) throw new Error("Driver carrier not found");
        if (carrier.status !== "active") {
          throw new Error("Driver carrier is not active");
        }
      }

      const vehicleResult = await client.query<{
        id: string;
        driverId: string | null;
        status: string;
        vehicleType: string;
        bodyType: string;
        capacityKg: string;
        freeMeters: string | null;
      }>(
        `select id, driver_id as "driverId", status,
                vehicle_type as "vehicleType", body_type as "bodyType",
                capacity_kg as "capacityKg", free_meters as "freeMeters"
           from vehicles
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

      const eligible = vehicleSatisfiesFreightRequirements(
        {
          vehicleTypes: freight.vehicleTypes,
          bodyTypes: freight.bodyTypes,
          weightKg: Number(freight.weightKg),
          minimumCapacityKg:
            freight.minimumCapacityKg === null
              ? null
              : Number(freight.minimumCapacityKg),
          minimumFreeMeters:
            freight.minimumFreeMeters === null
              ? null
              : Number(freight.minimumFreeMeters),
        },
        {
          vehicleType: vehicle.vehicleType,
          bodyType: vehicle.bodyType,
          capacityKg: Number(vehicle.capacityKg),
          freeMeters:
            vehicle.freeMeters === null ? null : Number(vehicle.freeMeters),
        },
      );
      if (!eligible) {
        throw new Error(
          "Vehicle does not satisfy freight matching requirements",
        );
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
          where tenant_id = $1 and id = $2 and status in ('matching', 'negotiating')
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
          freightStatus: freightUpdate.rows[0].status,
        },
      });

      return {
        assignment,
        freightStatus: freightUpdate.rows[0].status,
      };
    });
  }
}
