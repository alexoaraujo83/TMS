import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  PostgresFreightRepository,
  VehicleRepository,
  type FreightRow,
} from "@tms/database";
import { rankCandidates, type MatchResult } from "@tms/matching";
import type { BodyType, Freight, VehicleType } from "@tms/freight";
import type { Pool } from "pg";
import type { RequestContext } from "../../common/request-context.js";
import { DATABASE_POOL } from "../../common/database.provider.js";

function toFreight(row: FreightRow): Freight {
  return {
    id: row.id,
    tenantId: row.tenantId,
    status: row.status as Freight["status"],
    type: row.freightType as Freight["type"],
    origin: { city: row.originCity, state: row.originState, country: "BR" },
    destination: {
      city: row.destinationCity,
      state: row.destinationState,
      country: "BR",
    },
    cargo: {
      description: row.cargoDescription,
      quantity: row.quantity,
      weightKg: Number(row.weightKg),
      volumeM3: row.volumeM3 === null ? undefined : Number(row.volumeM3),
      linearMeters:
        row.linearMeters === null ? undefined : Number(row.linearMeters),
      valueCents:
        row.customerPriceCents === null
          ? undefined
          : BigInt(row.customerPriceCents),
    },
    vehicleRequirement: {
      types: row.vehicleTypes as VehicleType[],
      bodies: row.bodyTypes as BodyType[],
      minimumFreeMeters:
        row.minimumFreeMeters === null
          ? undefined
          : Number(row.minimumFreeMeters),
      minimumCapacityKg:
        row.minimumCapacityKg === null
          ? undefined
          : Number(row.minimumCapacityKg),
    },
    driverPrice:
      row.driverPriceCents === null
        ? undefined
        : { amountCents: BigInt(row.driverPriceCents), currency: "BRL" },
    customerPrice:
      row.customerPriceCents === null
        ? undefined
        : { amountCents: BigInt(row.customerPriceCents), currency: "BRL" },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

@Injectable()
export class MatchingService {
  private readonly freights: PostgresFreightRepository;
  private readonly vehicles: VehicleRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.freights = new PostgresFreightRepository(pool);
    this.vehicles = new VehicleRepository(pool);
  }

  async rank(
    context: RequestContext,
    freightId: string,
  ): Promise<readonly MatchResult[]> {
    const row = await this.freights.findById(context.tenantId, freightId);
    if (!row) throw new NotFoundException("Freight not found");

    const freight = toFreight(row);
    const records = await this.vehicles.findMatchingCandidates(
      context.tenantId,
      row.vehicleTypes,
      row.bodyTypes,
      Math.max(Number(row.minimumCapacityKg ?? 0), Number(row.weightKg)),
      row.minimumFreeMeters === null
        ? undefined
        : Number(row.minimumFreeMeters),
    );

    const candidates = records.map((record) => ({
      driverId: record.driverId,
      tenantId: record.tenantId,
      vehicleType: record.vehicleType as VehicleType,
      bodyType: record.bodyType as BodyType,
      capacityKg: Number(record.capacityKg),
      available: true,
      // Route distance is intentionally neutral until a routing/geocoding provider is integrated.
      distanceKm: 100,
      routeCompatibility: 50,
    }));

    return rankCandidates(freight, candidates);
  }
}
