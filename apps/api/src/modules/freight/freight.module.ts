import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database.module.js';
import { AuthGuard } from '../../common/auth.guard.js';
import { PermissionGuard } from '../../common/permission.guard.js';
import { FreightController } from './freight.controller.js';
import { FreightService } from './freight.service.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [FreightController],
  providers: [FreightService, MatchingService, AuthGuard, PermissionGuard],
})
export class FreightModule {}
