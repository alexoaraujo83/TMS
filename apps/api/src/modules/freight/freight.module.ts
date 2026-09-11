import { Module } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard.js';
import { PermissionGuard } from '../../common/permission.guard.js';
import { FreightController } from './freight.controller.js';
import { FreightService } from './freight.service.js';

@Module({
  controllers: [FreightController],
  providers: [FreightService, AuthGuard, PermissionGuard],
})
export class FreightModule {}
