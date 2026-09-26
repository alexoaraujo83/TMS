import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { withTransaction } from "./transaction.js";

export interface CarrierRecord {
  id: string;
  tenantId: string;
  legalName: string;
  documentNumber: string | null;
  status: string;
}
export interface DriverRecord {
  id: string;
  tenantId: string;
  carrierId: string | null;
  name: string;
  documentNumber: string | null;
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

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`Invalid ${field}`);
}

export interface CreateCarrierInput {
  tenantId: string;
  legalName: string;
  documentNumber?: string;
  status?: string;
}
export interface UpdateCarrierInput {
  tenantId: string;
  id: string;
  legalName?: string;
  documentNumber?: string;
  status?: string;
}
export interface CreateDriverInput {
  tenantId: string;
  carrierId?: string;
  name: string;
  documentNumber?: string;
  phone?: string;
  rntrc?: string;
  anttStatus?: string;
  status?: string;
}
export interface UpdateDriverInput {
  tenantId: string;
  id: string;
  carrierId?: string;
  name?: string;
  documentNumber?: string;
  phone?: string;
  rntrc?: string;
  anttStatus?: string;
  status?: string;
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
export interface UpdateVehicleInput {
  tenantId: string;
  id: string;
  driverId?: string;
  plate?: string;
  vehicleType?: string;
  bodyType?: string;
  capacityKg?: number;
  freeMeters?: number;
  status?: string;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

export class CarrierRepository {
  constructor(private readonly pool: Pool) {}
  async create(
    input: CreateCarrierInput,
    audit: AuditInput,
  ): Promise<CarrierRecord> {
    assertUuid(input.tenantId, "tenantId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        const result = await client.query<CarrierRecord>(
          `insert into carriers (tenant_id, legal_name, document_number, status) values ($1,$2,$3,$4) returning id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status`,
          [
            input.tenantId,
            input.legalName,
            input.documentNumber ?? null,
            input.status ?? "active",
          ],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Carrier creation failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: row.id,
          });
        return row;
      },
    );
  }
  async update(
    input: UpdateCarrierInput,
    audit: AuditInput,
  ): Promise<CarrierRecord | null> {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.id, "id");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        const current = await client.query<CarrierRecord>(
          `select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 and id = $2 for update`,
          [input.tenantId, input.id],
        );
        const before = current.rows[0];
        if (!before) return null;
        const result = await client.query<CarrierRecord>(
          `update carriers set legal_name = coalesce($3, legal_name), document_number = coalesce($4, document_number), status = coalesce($5, status) where tenant_id = $1 and id = $2 returning id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status`,
          [
            input.tenantId,
            input.id,
            input.legalName,
            input.documentNumber,
            input.status,
          ],
        );
        const after = result.rows[0];
        if (!after) throw new Error("Carrier update failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: after.id,
            beforeState: before,
            afterState: after,
          });
        return after;
      },
    );
  }
  async list(tenantId: string): Promise<readonly CarrierRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<CarrierRecord>(
            `select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 order by legal_name`,
            [tenantId],
          )
        ).rows,
    );
  }
  async findById(tenantId: string, id: string): Promise<CarrierRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<CarrierRecord>(
            `select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 and id = $2`,
            [tenantId, id],
          )
        ).rows[0] ?? null,
    );
  }
}

export class DriverRepository {
  constructor(private readonly pool: Pool) {}
  async create(
    input: CreateDriverInput,
    audit: AuditInput,
  ): Promise<DriverRecord> {
    assertUuid(input.tenantId, "tenantId");
    if (input.carrierId) assertUuid(input.carrierId, "carrierId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        if (input.carrierId) {
          const carrier = await client.query(
            `select 1 from carriers where tenant_id = $1 and id = $2`,
            [input.tenantId, input.carrierId],
          );
          if (carrier.rowCount !== 1)
            throw new Error("Carrier not found in tenant");
        }
        const result = await client.query<DriverRecord>(
          `insert into drivers (tenant_id, carrier_id, name, document_number, phone, rntrc, antt_status, status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status`,
          [
            input.tenantId,
            input.carrierId ?? null,
            input.name,
            input.documentNumber ?? null,
            input.phone ?? null,
            input.rntrc ?? null,
            input.anttStatus ?? "pending",
            input.status ?? "active",
          ],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Driver creation failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: row.id,
          });
        return row;
      },
    );
  }
  async update(
    input: UpdateDriverInput,
    audit: AuditInput,
  ): Promise<DriverRecord | null> {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.id, "id");
    if (input.carrierId) assertUuid(input.carrierId, "carrierId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
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
          if (carrier.rowCount !== 1)
            throw new Error("Carrier not found in tenant");
        }
        const result = await client.query<DriverRecord>(
          `update drivers set carrier_id = coalesce($3, carrier_id), name = coalesce($4, name), document_number = coalesce($5, document_number), phone = coalesce($6, phone), rntrc = coalesce($7, rntrc), antt_status = coalesce($8, antt_status), status = coalesce($9, status) where tenant_id = $1 and id = $2 returning id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status`,
          [
            input.tenantId,
            input.id,
            input.carrierId,
            input.name,
            input.documentNumber,
            input.phone,
            input.rntrc,
            input.anttStatus,
            input.status,
          ],
        );
        const after = result.rows[0];
        if (!after) throw new Error("Driver update failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: after.id,
            beforeState: before,
            afterState: after,
          });
        return after;
      },
    );
  }
  async list(tenantId: string): Promise<readonly DriverRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<DriverRecord>(
            `select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 order by name`,
            [tenantId],
          )
        ).rows,
    );
  }
  async findById(tenantId: string, id: string): Promise<DriverRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<DriverRecord>(
            `select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 and id = $2`,
            [tenantId, id],
          )
        ).rows[0] ?? null,
    );
  }
}

export class VehicleRepository {
  constructor(private readonly pool: Pool) {}
  async create(
    input: CreateVehicleInput,
    audit: AuditInput,
  ): Promise<VehicleRecord> {
    assertUuid(input.tenantId, "tenantId");
    if (input.driverId) assertUuid(input.driverId, "driverId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        if (input.driverId) {
          const driver = await client.query(
            `select 1 from drivers where tenant_id = $1 and id = $2`,
            [input.tenantId, input.driverId],
          );
          if (driver.rowCount !== 1)
            throw new Error("Driver not found in tenant");
        }
        const result = await client.query<VehicleRecord>(
          `insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, free_meters, status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status`,
          [
            input.tenantId,
            input.driverId ?? null,
            input.plate.toUpperCase(),
            input.vehicleType,
            input.bodyType,
            input.capacityKg,
            input.freeMeters ?? null,
            input.status ?? "available",
          ],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Vehicle creation failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: row.id,
          });
        return row;
      },
    );
  }
  async update(
    input: UpdateVehicleInput,
    audit: AuditInput,
  ): Promise<VehicleRecord | null> {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.id, "id");
    if (input.driverId) assertUuid(input.driverId, "driverId");
    return withTransaction(
      this.pool,
      { tenantId: input.tenantId },
      async (client) => {
        const current = await client.query<VehicleRecord>(
          `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 and id = $2 for update`,
          [input.tenantId, input.id],
        );
        const before = current.rows[0];
        if (!before) return null;
        if (input.driverId) {
          const driver = await client.query(
            `select 1 from drivers where tenant_id = $1 and id = $2`,
            [input.tenantId, input.driverId],
          );
          if (driver.rowCount !== 1)
            throw new Error("Driver not found in tenant");
        }
        const result = await client.query<VehicleRecord>(
          `update vehicles set driver_id = coalesce($3, driver_id), plate = coalesce($4, plate), vehicle_type = coalesce($5, vehicle_type), body_type = coalesce($6, body_type), capacity_kg = coalesce($7, capacity_kg), free_meters = coalesce($8, free_meters), status = coalesce($9, status) where tenant_id = $1 and id = $2 returning id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status`,
          [
            input.tenantId,
            input.id,
            input.driverId,
            input.plate?.toUpperCase(),
            input.vehicleType,
            input.bodyType,
            input.capacityKg,
            input.freeMeters,
            input.status,
          ],
        );
        const after = result.rows[0];
        if (!after) throw new Error("Vehicle update failed");
        if (audit)
          await appendAuditEvent(client, {
            ...audit,
            tenantId: input.tenantId,
            entityId: after.id,
            beforeState: before,
            afterState: after,
          });
        return after;
      },
    );
  }
  async list(tenantId: string): Promise<readonly VehicleRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<VehicleRecord>(
            `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 order by plate`,
            [tenantId],
          )
        ).rows,
    );
  }
  async findById(tenantId: string, id: string): Promise<VehicleRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(
      this.pool,
      { tenantId },
      async (client) =>
        (
          await client.query<VehicleRecord>(
            `select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 and id = $2`,
            [tenantId, id],
          )
        ).rows[0] ?? null,
    );
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
           from drivers d join vehicles v on v.driver_id = d.id and v.tenant_id = d.tenant_id
           left join carriers c on c.id = d.carrier_id and c.tenant_id = d.tenant_id
          where d.tenant_id = $1 and d.status = 'active' and d.antt_status = 'approved' and (d.carrier_id is null or c.status = 'active') and v.status = 'available' and v.capacity_kg >= $2
            and (cardinality($3::text[]) = 0 or v.vehicle_type = any($3::text[]))
            and (cardinality($4::text[]) = 0 or v.body_type = any($4::text[]))
            and ($5::numeric is null or v.free_meters >= $5::numeric)
            and not exists (select 1 from freight_assignments fa where fa.tenant_id = d.tenant_id and fa.status = 'active' and (fa.driver_id = d.id or fa.vehicle_id = v.id))
          order by v.capacity_kg asc, d.id`,
        [
          tenantId,
          minimumCapacityKg,
          vehicleTypes,
          bodyTypes,
          minimumFreeMeters ?? null,
        ],
      );
      return result.rows;
    });
  }
}
