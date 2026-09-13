import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  MatchingCandidateRepository,
  PostgresFreightRepository,
  type FreightRow,
} from "@tms/database";
import { rankCandidates, type MatchResult } from "@tms/matching";
import type { BodyType, Freight, VehicleType } from "@tms/freight";
import type { Pool } from "pg";
import type { RequestContext } from "../../common/request-context.js";
import { DATABASE_POOL } from "../../common/database.provider.js";
import { assertMatchingTenant } from "../matching/matching.contracts.js";

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class MatchingService {
  private readonly freights: PostgresFreightRepository;
  private readonly candidates: MatchingCandidateRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.freights = new PostgresFreightRepository(pool);
    this.candidates = new MatchingCandidateRepository(pool);
  }

  async rank(
    context: RequestContext,
    freightId: string,
  ): Promise<readonly MatchResult[]> {
    const row = await this.freights.findById(context.tenantId, freightId);
    if (!row) throw new NotFoundException("Freight not found");

    const freight = toFreight(row);
    const records = await this.candidates.findAvailable(
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
      vehicleId: record.vehicleId,
      driverName: record.driverName,
      plate: record.plate,
      vehicleType: record.vehicleType as VehicleType,
      bodyType: record.bodyType as BodyType,
      capacityKg: Number(record.capacityKg),
      freeMeters:
        record.freeMeters === null ? undefined : Number(record.freeMeters),
      available: record.availability === "available",
    }));

    assertMatchingTenant(context.tenantId, freight, candidates);
    return rankCandidates(freight, candidates);
  }
}
