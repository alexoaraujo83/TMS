import type { Pool } from 'pg';
import { withTransaction } from './transaction.js';

export interface FreightRow {
  id: string;
  tenantId: string;
  status: string;
  freightType: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  cargoDescription: string;
  quantity: number;
  weightKg: string;
  volumeM3: string | null;
  linearMeters: string | null;
  customerPriceCents: string | null;
  driverPriceCents: string | null;
}

export class PostgresFreightRepository {
  constructor(private readonly pool: Pool) {}

  async findById(tenantId: string, freightId: string): Promise<FreightRow | null> {
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<FreightRow>(
        `select id,
                tenant_id as "tenantId",
                status,
                freight_type as "freightType",
                origin_city as "originCity",
                origin_state as "originState",
                destination_city as "destinationCity",
                destination_state as "destinationState",
                cargo_description as "cargoDescription",
                quantity,
                weight_kg as "weightKg",
                volume_m3 as "volumeM3",
                linear_meters as "linearMeters",
                customer_price_cents as "customerPriceCents",
                driver_price_cents as "driverPriceCents"
           from freights
          where id = $1
            and tenant_id = $2
          limit 1`,
        [freightId, tenantId],
      );
      return result.rows[0] ?? null;
    });
  }

  async list(tenantId: string): Promise<readonly FreightRow[]> {
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<FreightRow>(
        `select id,
                tenant_id as "tenantId",
                status,
                freight_type as "freightType",
                origin_city as "originCity",
                origin_state as "originState",
                destination_city as "destinationCity",
                destination_state as "destinationState",
                cargo_description as "cargoDescription",
                quantity,
                weight_kg as "weightKg",
                volume_m3 as "volumeM3",
                linear_meters as "linearMeters",
                customer_price_cents as "customerPriceCents",
                driver_price_cents as "driverPriceCents"
           from freights
          where tenant_id = $1
          order by created_at desc`,
        [tenantId],
      );
      return result.rows;
    });
  }
}
