import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import {
  CreateCarrierDto,
  CreateDriverDto,
  CreateVehicleDto,
  UpdateCarrierDto,
  UpdateDriverDto,
  UpdateVehicleDto,
} from "./operations.dto.js";
import { OperationsService } from "./operations.service.js";

@Controller("operations")
@UseGuards(AuthGuard, PermissionGuard)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Post("carriers")
  @RequirePermission("carrier:create")
  createCarrier(
    @CurrentUser() context: RequestContext,
    @Body() dto: CreateCarrierDto,
  ) {
    return this.service.createCarrier(context, dto);
  }

  @Get("carriers")
  @RequirePermission("carrier:read")
  listCarriers(@CurrentUser() context: RequestContext) {
    return this.service.listCarriers(context);
  }

  @Get("carriers/:id")
  @RequirePermission("carrier:read")
  getCarrier(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getCarrier(context, id);
  }

  @Patch("carriers/:id")
  @RequirePermission("carrier:update")
  updateCarrier(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCarrierDto,
  ) {
    return this.service.updateCarrier(context, id, dto);
  }

  @Post("drivers")
  @RequirePermission("driver:create")
  createDriver(
    @CurrentUser() context: RequestContext,
    @Body() dto: CreateDriverDto,
  ) {
    return this.service.createDriver(context, dto);
  }

  @Get("drivers")
  @RequirePermission("driver:read")
  listDrivers(@CurrentUser() context: RequestContext) {
    return this.service.listDrivers(context);
  }

  @Get("drivers/:id")
  @RequirePermission("driver:read")
  getDriver(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getDriver(context, id);
  }

  @Patch("drivers/:id")
  @RequirePermission("driver:update")
  updateDriver(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDriverDto,
  ) {
    return this.service.updateDriver(context, id, dto);
  }

  @Post("vehicles")
  @RequirePermission("vehicle:create")
  createVehicle(
    @CurrentUser() context: RequestContext,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.service.createVehicle(context, dto);
  }

  @Get("vehicles")
  @RequirePermission("vehicle:read")
  listVehicles(@CurrentUser() context: RequestContext) {
    return this.service.listVehicles(context);
  }

  @Get("vehicles/:id")
  @RequirePermission("vehicle:read")
  getVehicle(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.getVehicle(context, id);
  }

  @Patch("vehicles/:id")
  @RequirePermission("vehicle:update")
  updateVehicle(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.service.updateVehicle(context, id, dto);
  }
}
