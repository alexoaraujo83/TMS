import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import {
  CreateComplianceCheckDto,
  CreateGrRequestDto,
  TransitionComplianceDto,
  TransitionGrDto,
} from "./compliance.dto.js";
import { ComplianceService } from "./compliance.service.js";

@Controller("compliance")
@UseGuards(AuthGuard, PermissionGuard)
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  @Post("checks")
  @RequirePermission("compliance:create")
  createCheck(@CurrentUser() context: RequestContext, @Body() dto: CreateComplianceCheckDto) {
    return this.service.createCheck(context, dto);
  }

  @Get("checks")
  @RequirePermission("compliance:read")
  listChecks(@CurrentUser() context: RequestContext, @Query("freightId") freightId?: string) {
    return this.service.listChecks(context, freightId);
  }

  @Patch("checks/:id/status")
  @RequirePermission("compliance:update")
  transitionCheck(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionComplianceDto,
  ) {
    return this.service.transitionCheck(context, id, dto);
  }

  @Post("gr")
  @RequirePermission("compliance:create")
  createGr(@CurrentUser() context: RequestContext, @Body() dto: CreateGrRequestDto) {
    return this.service.createGr(context, dto);
  }

  @Get("gr")
  @RequirePermission("compliance:read")
  listGr(@CurrentUser() context: RequestContext, @Query("freightId") freightId?: string) {
    return this.service.listGr(context, freightId);
  }

  @Patch("gr/:id/status")
  @RequirePermission("compliance:update")
  transitionGr(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: TransitionGrDto,
  ) {
    return this.service.transitionGr(context, id, dto);
  }
}
