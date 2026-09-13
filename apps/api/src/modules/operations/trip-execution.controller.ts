import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import { CreateOccurrenceDto, CreatePodDto } from "./trip-execution.dto.js";
import { TripExecutionService } from "./trip-execution.service.js";

@Controller("operations/trips/:tripId")
@UseGuards(AuthGuard, PermissionGuard)
export class TripExecutionController {
  constructor(private readonly service: TripExecutionService) {}

  @Post("occurrences")
  @RequirePermission("trip:update")
  createOccurrence(
    @CurrentUser() context: RequestContext,
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
    @Body() dto: CreateOccurrenceDto,
  ) {
    return this.service.createOccurrence(context, tripId, dto);
  }

  @Get("occurrences")
  @RequirePermission("trip:read")
  listOccurrences(
    @CurrentUser() context: RequestContext,
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
  ) {
    return this.service.listOccurrences(context, tripId);
  }

  @Post("pod")
  @RequirePermission("trip:update")
  createPod(
    @CurrentUser() context: RequestContext,
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
    @Body() dto: CreatePodDto,
  ) {
    return this.service.createPod(context, tripId, dto);
  }

  @Get("pod")
  @RequirePermission("trip:read")
  getPod(
    @CurrentUser() context: RequestContext,
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
  ) {
    return this.service.getPod(context, tripId);
  }

  @Get("timeline")
  @RequirePermission("trip:read")
  listTimeline(
    @CurrentUser() context: RequestContext,
    @Param("tripId", new ParseUUIDPipe()) tripId: string,
  ) {
    return this.service.listTimeline(context, tripId);
  }
}
