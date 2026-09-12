import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { AuditRepository, PostgresFreightRepository, type FreightRow } from '@tms/database';
import type { FreightStatus } from '@tms/freight';
import type { RequestContext } from '../../common/request-context.js';
import type { CreateFreightDto, UpdateFreightStatusDto } from './freight.dto.js';
import { DATABASE_POOL } from '../../common/database.provider.js';
import type { Pool } from 'pg';

const transitions: Readonly<Record<FreightStatus, readonly FreightStatus[]>> = {
  draft: ['open', 'cancelled'],
  open: ['matching', 'cancelled'],
  matching: ['negotiating', 'open', 'cancelled'],
  negotiating: ['assigned', 'matching', 'cancelled'],
  assigned: ['in_transit', 'cancelled'],
  in_transit: ['delivered'],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class FreightService {
  private readonly repository: PostgresFreightRepository;
  private readonly audit: AuditRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new PostgresFreightRepository(pool);
    this.audit = new AuditRepository(pool);
  }

  async create(context: RequestContext, dto: CreateFreightDto): Promise<FreightRow> {
    const created = await this.repository.create({
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

    await this.audit.append({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: 'freight.created',
      entityType: 'freight',
      entityId: created.id,
      requestId: context.requestId,
      afterState: { status: created.status, freightType: created.freightType },
    });

    return created;
  }

  list(context: RequestContext): Promise<readonly FreightRow[]> {
    return this.repository.list(context.tenantId);
  }

  async get(context: RequestContext, freightId: string): Promise<FreightRow> {
    const freight = await this.repository.findById(context.tenantId, freightId);
    if (!freight) throw new NotFoundException('Freight not found');
    return freight;
  }

  async updateStatus(context: RequestContext, freightId: string, dto: UpdateFreightStatusDto): Promise<FreightRow> {
    const current = await this.repository.findById(context.tenantId, freightId);
    if (!current) throw new NotFoundException('Freight not found');

    const currentStatus = current.status as FreightStatus;
    if (!transitions[currentStatus]?.includes(dto.status)) {
      throw new ConflictException(`Invalid freight status transition: ${currentStatus} -> ${dto.status}`);
    }

    const updated = await this.repository.updateStatus(context.tenantId, freightId, currentStatus, dto.status);
    if (!updated) throw new ConflictException('Freight was changed by another request');

    await this.audit.append({
      tenantId: context.tenantId,
      actorUserId: context.userId,
      action: 'freight.status_changed',
      entityType: 'freight',
      entityId: updated.id,
      requestId: context.requestId,
      beforeState: { status: currentStatus },
      afterState: { status: updated.status },
    });

    return updated;
  }
}
