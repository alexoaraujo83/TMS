import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard.js';
import { CurrentUser } from '../../common/current-user.decorator.js';
import { PermissionGuard } from '../../common/permission.guard.js';
import { RequirePermission } from '../../common/permission.decorator.js';
import type { RequestContext } from '../../common/request-context.js';
import { CreateFreightDto, UpdateFreightStatusDto } from './freight.dto.js';
import { FreightService } from './freight.service.js';

@Controller('freights')
@UseGuards(AuthGuard, PermissionGuard)
export class FreightController {
  constructor(private readonly service: FreightService) {}

  @Post()
  @RequirePermission('freight:create')
  create(@CurrentUser() context: RequestContext, @Body() dto: CreateFreightDto) {
    return this.service.create(context, dto);
  }

  @Get()
  @RequirePermission('freight:read')
  list(@CurrentUser() context: RequestContext) {
    return this.service.list(context);
  }

  @Get(':id')
  @RequirePermission('freight:read')
  get(@CurrentUser() context: RequestContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.get(context, id);
  }

  @Patch(':id/status')
  @RequirePermission('freight:update')
  updateStatus(
    @CurrentUser() context: RequestContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFreightStatusDto,
  ) {
    return this.service.updateStatus(context, id, dto);
  }
}
