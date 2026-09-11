import type { Pool } from 'pg';
import { withTransaction } from './transaction.js';

export interface CarrierRecord { id: string; tenantId: string; legalName: string; documentNumber: string | null; status: string; }
export interface DriverRecord { id: string; tenantId: string; carrierId: string | null; name: string; documentNumber: string | null; phone: string | null; rntrc: string | null; anttStatus: string; status: string; }
export interface VehicleRecord { id: string; tenantId: string; driverId: string | null; plate: string; vehicleType: string; bodyType: string; capacityKg: string; freeMeters: string | null; status: string; }

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`Invalid ${field}`);
}

export class CarrierRepository {
  constructor(private readonly pool: Pool) {}
  async list(tenantId: string): Promise<readonly CarrierRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<CarrierRecord>(`select id, tenant_id as "tenantId", legal_name as "legalName", document_number as "documentNumber", status from carriers where tenant_id = $1 order by legal_name`, [tenantId]);
      return result.rows;
    });
  }
}

export class DriverRepository {
  constructor(private readonly pool: Pool) {}
  async list(tenantId: string): Promise<readonly DriverRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<DriverRecord>(`select id, tenant_id as "tenantId", carrier_id as "carrierId", name, document_number as "documentNumber", phone, rntrc, antt_status as "anttStatus", status from drivers where tenant_id = $1 order by name`, [tenantId]);
      return result.rows;
    });
  }
}

export class VehicleRepository {
  constructor(private readonly pool: Pool) {}
  async list(tenantId: string): Promise<readonly VehicleRecord[]> {
    assertUuid(tenantId, 'tenantId');
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<VehicleRecord>(`select id, tenant_id as "tenantId", driver_id as "driverId", plate, vehicle_type as "vehicleType", body_type as "bodyType", capacity_kg as "capacityKg", free_meters as "freeMeters", status from vehicles where tenant_id = $1 order by plate`, [tenantId]);
      return result.rows;
    });
  }
}
