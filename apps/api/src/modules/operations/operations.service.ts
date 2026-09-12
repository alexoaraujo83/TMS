import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CarrierRepository, DriverRepository, VehicleRepository } from '@tms/database';
import type { RequestContext } from '../../common/request-context.js';
import { DATABASE_POOL } from '../../common/database.provider.js';
import type { Pool } from 'pg';
import type { CreateCarrierDto, CreateDriverDto, CreateVehicleDto } from './operations.dto.js';

@Injectable()
export class OperationsService {
  private readonly carriers: CarrierRepository;
  private readonly drivers: DriverRepository;
  private readonly vehicles: VehicleRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.carriers = new CarrierRepository(pool);
    this.drivers = new DriverRepository(pool);
    this.vehicles = new VehicleRepository(pool);
  }

  createCarrier(context: RequestContext, dto: CreateCarrierDto) {
    return this.carriers.create(
      { tenantId: context.tenantId, ...dto },
      {
        actorUserId: context.userId,
        action: 'carrier.created',
        entityType: 'carrier',
        requestId: context.requestId,
        afterState: { legalName: dto.legalName, status: dto.status ?? 'active' },
      },
    );
  }
  listCarriers(context: RequestContext) { return this.carriers.list(context.tenantId); }
  async getCarrier(context: RequestContext, id: string) { const item = await this.carriers.findById(context.tenantId, id); if (!item) throw new NotFoundException('Carrier not found'); return item; }

  createDriver(context: RequestContext, dto: CreateDriverDto) {
    return this.drivers.create(
      { tenantId: context.tenantId, ...dto },
      {
        actorUserId: context.userId,
        action: 'driver.created',
        entityType: 'driver',
        requestId: context.requestId,
        afterState: { name: dto.name, carrierId: dto.carrierId ?? null, anttStatus: dto.anttStatus ?? 'pending', status: dto.status ?? 'active' },
      },
    );
  }
  listDrivers(context: RequestContext) { return this.drivers.list(context.tenantId); }
  async getDriver(context: RequestContext, id: string) { const item = await this.drivers.findById(context.tenantId, id); if (!item) throw new NotFoundException('Driver not found'); return item; }

  createVehicle(context: RequestContext, dto: CreateVehicleDto) {
    return this.vehicles.create(
      { tenantId: context.tenantId, ...dto },
      {
        actorUserId: context.userId,
        action: 'vehicle.created',
        entityType: 'vehicle',
        requestId: context.requestId,
        afterState: { plate: dto.plate.toUpperCase(), driverId: dto.driverId ?? null, vehicleType: dto.vehicleType, bodyType: dto.bodyType, status: dto.status ?? 'available' },
      },
    );
  }
  listVehicles(context: RequestContext) { return this.vehicles.list(context.tenantId); }
  async getVehicle(context: RequestContext, id: string) { const item = await this.vehicles.findById(context.tenantId, id); if (!item) throw new NotFoundException('Vehicle not found'); return item; }
}
