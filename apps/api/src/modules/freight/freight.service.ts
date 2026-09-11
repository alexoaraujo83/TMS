import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresFreightRepository, type FreightRow } from '@tms/database';
import type { RequestContext } from '../../common/request-context.js';
import type { CreateFreightDto } from './freight.dto.js';
import { DATABASE_POOL } from '../../common/database.provider.js';
import type { Pool } from 'pg';

@Injectable()
export class FreightService {
  private readonly repository: PostgresFreightRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new PostgresFreightRepository(pool);
  }

  create(context: RequestContext, dto: CreateFreightDto): Promise<FreightRow> {
    return this.repository.create({
      tenantId: context.tenantId,
      freightType: dto.freightType,
      originCity: dto.originCity,
      originState: dto.originState.toUpperCase(),
      destinationCity: dto.destinationCity,
      destinationState: dto.destinationState.toUpperCase(),
      cargoDescription: dto.cargoDescription,
      quantity: dto.quantity,
      weightKg: dto.weightKg,
      volumeM3: dto.volumeM3,
      linearMeters: dto.linearMeters,
      customerPriceCents: dto.customerPriceCents,
      driverPriceCents: dto.driverPriceCents,
      vehicleTypes: dto.vehicleTypes,
      bodyTypes: dto.bodyTypes,
      minimumFreeMeters: dto.minimumFreeMeters,
      minimumCapacityKg: dto.minimumCapacityKg,
    });
  }

  list(context: RequestContext): Promise<readonly FreightRow[]> {
    return this.repository.list(context.tenantId);
  }

  async get(context: RequestContext, freightId: string): Promise<FreightRow> {
    const freight = await this.repository.findById(context.tenantId, freightId);
    if (!freight) throw new NotFoundException('Freight not found');
    return freight;
  }
}
