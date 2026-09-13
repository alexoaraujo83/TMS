import type { Pool } from "pg";
import { withTransaction } from "./transaction.js";

export interface EnrichedMatchingCandidateRecord {
  driverId: string;
  driverName: string;
  tenantId: string;
  vehicleId: string;
  plate: string;
  vehicleType: string;
  bodyType: string;
  capacityKg: string;
  freeMeters: string | null;
  availability: "available";
}

function assertUuid(value: string, field: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`Invalid ${field}`);
}

export class MatchingCandidateRepository {
  constructor(private readonly pool: Pool) {}

  async findAvailable(
    tenantId: string,
    vehicleTypes: readonly string[],
    bodyTypes: readonly string[],
    minimumCapacityKg: number,
    minimumFreeMeters?: number,
  ): Promise<readonly EnrichedMatchingCandidateRecord[]> {
    assertUuid(tenantId, "tenantId");

    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<EnrichedMatchingCandidateRecord>(
        `select
           d.id as "driverId",
           d.name as "driverName",
           d.tenant_id as "tenantId",
           v.id as "vehicleId",
           v.plate,
           v.vehicle_type as "vehicleType",
           v.body_type as "bodyType",
           v.capacity_kg as "capacityKg",
           v.free_meters as "freeMeters",
           'available'::text as "availability"
         from drivers d
         join vehicles v on v.driver_id = d.id and v.tenant_id = d.tenant_id
         left join carriers c on c.id = d.carrier_id and c.tenant_id = d.tenant_id
        where d.tenant_id = $1
          and d.status = 'active'
          and d.antt_status = 'approved'
          and (d.carrier_id is null or c.status = 'active')
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
        order by v.capacity_kg asc, d.id, v.id`,
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
