import type { Pool } from 'pg';
import { withTransaction } from './transaction.js';

export interface CarrierRecord { id: string; tenantId: string; legalName: string; documentNumber: string | null; status: string; }
export interface DriverRecord { id: string; tenantId: string; carrierId: string | null; name: string; documentNumber: string | null; phone: string | null; rntrc: string | null; anttStatus: string; status: string; }
export interface VehicleRecord { id: string; tenantId: string; driverId: string | null; plate: string; vehicleType: string; bodyType: string; capacityKg: string; freeMeters: string | null; status: string; }

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`Invalid ${field}`);
}

export interface CreateCarrierInput { tenantId: string; legalName: string; documentNumber?: string; status?: string; }
export interface CreateDriverInput { tenantId: string; carrierId?: string; name: string; documentNumber?: string; phone?: string; rntrc?: string; anttStatus?: string; status?: string; }
export interface CreateVehicleInput { tenantId: string; driverId?: string; plate: string; vehicleType: string; bodyType: string; capacityKg: number; freeMeters?: number; status?: string; }

export class CarrierRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: CreateCarrierInput): Promise<CarrierRecord> {
    assertUuid(input.tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      const result = await client.query<CarrierRecord>(`insert into carriers (tenant_id, legal_name, document_number, status) values ($1,$2,$3,$4) returning id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status`, [input.tenantId, input.legalName, input.documentNumber ?? null, input.status ?? 'active']);
      return result.rows[0]!;
    });
  }
  async list(tenantId: string): Promise<readonly CarrierRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<CarrierRecord>(`select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 order by legal_name`, [tenantId]);
      return result.rows;
    });
  }
  async findById(tenantId: string, id: string): Promise<CarrierRecord | null> {
    assertUuid(tenantId, 'tenantId'); assertUuid(id, 'id');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<CarrierRecord>(`select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 and id = $2`, [tenantId, id]);
      return result.rows[0] ?? null;
    });
  }
}

export class DriverRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: CreateDriverInput): Promise<DriverRecord> {
    assertUuid(input.tenantId, 'tenantId');
    if (input.carrierId) assertUuid(input.carrierId, 'carrierId');
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      if (input.carrierId) {
        const carrier = await client.query(`select 1 from carriers where tenant_id = $1 and id = $2`, [input.tenantId, input.carrierId]);
        if (carrier.rowCount !== 1) throw new Error('Carrier not found in tenant');
      }
      const result = await client.query<DriverRecord>(`insert into drivers (tenant_id, carrier_id, name, document_number, phone, rntrc, antt_status, status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status`, [input.tenantId, input.carrierId ?? null, input.name, input.documentNumber ?? null, input.phone ?? null, input.rntrc ?? null, input.anttStatus ?? 'pending', input.status ?? 'active']);
      return result.rows[0]!;
    });
  }
  async list(tenantId: string): Promise<readonly DriverRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<DriverRecord>(`select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 order by name`, [tenantId]);
      return result.rows;
    });
  }
  async findById(tenantId: string, id: string): Promise<DriverRecord | null> {
    assertUuid(tenantId, 'tenantId'); assertUuid(id, 'id');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<DriverRecord>(`select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 and id = $2`, [tenantId, id]);
      return result.rows[0] ?? null;
    });
  }
}

export class VehicleRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: CreateVehicleInput): Promise<VehicleRecord> {
    assertUuid(input.tenantId, 'tenantId');
    if (input.driverId) assertUuid(input.driverId, 'driverId');
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      if (input.driverId) {
        const driver = await client.query(`select 1 from drivers where tenant_id = $1 and id = $2`, [input.tenantId, input.driverId]);
        if (driver.rowCount !== 1) throw new Error('Driver not found in tenant');
      }
      const result = await client.query<VehicleRecord>(`insert into vehicles (tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, free_meters, status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status`, [input.tenantId, input.driverId ?? null, input.plate.toUpperCase(), input.vehicleType, input.bodyType, input.capacityKg, input.freeMeters ?? null, input.status ?? 'available']);
      return result.rows[0]!;
    });
  }
  async list(tenantId: string): Promise<readonly VehicleRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<VehicleRecord>(`select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 order by plate`, [tenantId]);
      return result.rows;
    });
  }
  async findById(tenantId: string, id: string): Promise<VehicleRecord | null> {
    assertUuid(tenantId, 'tenantId'); assertUuid(id, 'id');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<VehicleRecord>(`select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 and id = $2`, [tenantId, id]);
      return result.rows[0] ?? null;
    });
  }
}
