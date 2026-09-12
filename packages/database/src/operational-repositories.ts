import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export interface DriverRecord {
  id: string;
  tenantId: string;
  carrierId: string | null;
  name: string;
  documentNumber: string;
  phone: string | null;
  rntrc: string | null;
  anttStatus: string;
  status: string;
}

export interface VehicleRecord {
  id: string;
  tenantId: string;
  driverId: string | null;
  plate: string;
  vehicleType: string;
  bodyType: string;
  capacityKg: string;
  freeMeters: string | null;
  status: string;
}

export interface MatchingCandidateRecord {
  driverId: string;
  tenantId: string;
  vehicleType: string;
  bodyType: string;
  capacityKg: string;
  freeMeters: string | null;
}

export interface CreateDriverInput {
  tenantId: string;
  carrierId?: string;
  name: string;
  documentNumber: string;
  phone?: string;
  rntrc?: string;
  anttStatus?: string;
  status?: string;
}

export interface UpdateDriverInput extends Partial<Omit<CreateDriverInput, "tenantId">> {
  tenantId: string;
  id: string;
}

export interface CreateVehicleInput {
  tenantId: string;
  driverId?: string;
  plate: string;
  vehicleType: string;
  bodyType: string;
  capacityKg: number;
  freeMeters?: number;
  status?: string;
}

export interface UpdateVehicleInput extends Partial<Omit<CreateVehicleInput, "tenantId">> {
  tenantId: string;
  id: string;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

export class DriverRepository {
  constructor(private readonly pool: Pool) {}

  async update(
    input: UpdateDriverInput,
    audit?: AuditInput,
  ): Promise<DriverRecord | null> {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.id, "id");
    if (input.carrierId) assertUuid(input.carrierId, "carrierId");
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      const current = await client.query<DriverRecord>(
        `select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 and id = $2 for update`,
        [input.tenantId, input.id],
      );
      const before = current.rows[0];
      if (!before) return null;
      if (input.carrierId) {
        const carrier = await client.query(
          `select 1 from carriers where tenant_id = $1 and id = $2`,
          [input.tenantId, input.carrierId],
        );
        if (carrier.rowCount !== 1) throw new Error("Carrier not found in tenant");
      }
      const result = await client.query<DriverRecord>(
        `update drivers set carrier_id = coalesce($3, carrier_id), name = coalesce($4, name), document_number = coalesce($5, document_number), phone = coalesce($6, phone), rntrc = coalesce($7, rntrc), antt_status = coalesce($8, antt_status), status = coalesce($9, status) where tenant_id = $1 and id = $2 returning id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status`,
        [input.tenantId, input.id, input.carrierId, input.name, input.documentNumber, input.phone, input.rntrc, input.anttStatus, input.status],
      );
      const after = result.rows[0];
      if (!after) throw new Error("Driver update failed");
      if (audit) await appendAuditEvent(client, { ...audit, tenantId: input.tenantId, entityId: after.id, beforeState: before, afterState: after });
      return after;
    });
  }

  async list(tenantId: string): Promise<readonly DriverRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<DriverRecord>(
        `select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 order by name`,
        [tenantId],
      );
      return result.rows;
    });
  }

  async findById(tenantId: string, id: string): Promise<DriverRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<DriverRecord>(
        `select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      return result.rows[0] ?? null;
    });
  }
}

export class VehicleRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateVehicleInput, audit?: AuditInput): Promise<VehicleRecord> {
    assertUuid(input.tenantId, "tenantId");
    if (input.driverId) assertUuid(input.driverId, "driverId");
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      if (input.driverId) {
        const driver = await client.query(`select 1 from drivers where tenant_id = $1 and id = $2`, [input.tenantId, input.driverId]);
        if (driver.rowCount !== 1) throw new Error("Driver not found in tenant");
      }
      const result = await client.query<VehicleRecord>(
        `insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, free_meters, status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status`,
        [input.tenantId, input.driverId ?? null, input.plate.toUpperCase(), input.vehicleType, input.bodyType, input.capacityKg, input.freeMeters ?? null, input.status ?? "available"],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Vehicle creation failed");
      if (audit) await appendAuditEvent(client, { ...audit, tenantId: input.tenantId, entityId: row.id });
      return row;
    });
  }

  async update(input: UpdateVehicleInput, audit?: AuditInput): Promise<VehicleRecord | null> {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.id, "id");
    if (input.driverId) assertUuid(input.driverId, "driverId");
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      const current = await client.query<VehicleRecord>(
        `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 and id = $2 for update`,
        [input.tenantId, input.id],
      );
      const before = current.rows[0];
      if (!before) return null;
      if (input.driverId) {
        const driver = await client.query(`select 1 from drivers where tenant_id = $1 and id = $2`, [input.tenantId, input.driverId]);
        if (driver.rowCount !== 1) throw new Error("Driver not found in tenant");
      }
      const result = await client.query<VehicleRecord>(
        `update vehicles set driver_id = coalesce($3, driver_id), plate = coalesce($4, plate), vehicle_type = coalesce($5, vehicle_type), body_type = coalesce($6, body_type), capacity_kg = coalesce($7, capacity_kg), free_meters = coalesce($8, free_meters), status = coalesce($9, status) where tenant_id = $1 and id = $2 returning id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status`,
        [input.tenantId, input.id, input.driverId, input.plate?.toUpperCase(), input.vehicleType, input.bodyType, input.capacityKg, input.freeMeters, input.status],
      );
      const after = result.rows[0];
      if (!after) throw new Error("Vehicle update failed");
      if (audit) await appendAuditEvent(client, { ...audit, tenantId: input.tenantId, entityId: after.id, beforeState: before, afterState: after });
      return after;
    });
  }

  async list(tenantId: string): Promise<readonly VehicleRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<VehicleRecord>(
        `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 order by plate`,
        [tenantId],
      );
      return result.rows;
    });
  }

  async findById(tenantId: string, id: string): Promise<VehicleRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<VehicleRecord>(
        `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 and id = $2`,
        [tenantId, id],
      );
      return result.rows[0] ?? null;
    });
  }

  async findMatchingCandidates(
    tenantId: string,
    vehicleTypes: readonly string[],
    bodyTypes: readonly string[],
    minimumCapacityKg: number,
    minimumFreeMeters?: number,
  ): Promise<readonly MatchingCandidateRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<MatchingCandidateRecord>(
        `select d.id as "driverId", d.tenant_id as "tenantId", v.vehicle_type as "vehicleType", v.body_type as "bodyType", v.capacity_kg as "capacityKg", v.free_meters as "freeMeters"
           from drivers d
           join vehicles v on v.driver_id = d.id and v.tenant_id = d.tenant_id
          where d.tenant_id = $1
            and d.status = 'active'
            and d.antt_status = 'approved'
            and v.status = 'available'
            and v.capacity_kg >= $2
            and (cardinality($3::text[]) = 0 or v.vehicle_type = any($3::text[]))
            and (cardinality($4::text[]) = 0 or v.body_type = any($4::text[]))
            and ($5::numeric is null or v.free_meters >= $5::numeric)
            and not exists (
              select 1
                from freight_assignments fa
               where fa.tenant_id = d.tenant_id
                 and fa.status = 'active'
                 and (fa.driver_id = d.id or fa.vehicle_id = v.id)
            )
          order by v.capacity_kg asc, d.id`,
        [tenantId, minimumCapacityKg, vehicleTypes, bodyTypes, minimumFreeMeters ?? null],
      );
      return result.rows;
    });
  }
}
