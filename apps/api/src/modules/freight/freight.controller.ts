import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Inject,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard.js";
import { DATABASE_POOL } from "../../common/database.provider.js";
import { withTenantContext } from "@tms/database";
import type { Pool } from "pg";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import { AssignFreightDto } from "./assignment.dto.js";
import { AssignmentService } from "./assignment.service.js";
import { CreateFreightDto, UpdateFreightStatusDto } from "./freight.dto.js";
import { FreightService } from "./freight.service.js";
import { MatchingService } from "./matching.service.js";

@Controller("freights")
@UseGuards(AuthGuard, PermissionGuard)
export class FreightController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly service: FreightService,
    private readonly matching: MatchingService,
    private readonly assignments: AssignmentService,
  ) {}

  @Post()
  @RequirePermission("freight:create")
  create(
    @CurrentUser() context: RequestContext,
    @Body() dto: CreateFreightDto,
  ) {
    return this.service.create(context, dto);
  }

  @Get()
  @RequirePermission("freight:read")
  list(@CurrentUser() context: RequestContext) {
    return this.service.list(context);
  }

  @Get("runtime-context")
  @RequirePermission("freight:read")
  runtimeContext(@CurrentUser() context: RequestContext) {
    return {
      authenticated: true,
      tenantId: context.tenantId,
      userId: context.userId,
      roles: context.roles,
      permissions: context.permissions,
    };
  }

  @Get("runtime-db-context")
  @RequirePermission("freight:read")
  async runtimeDbContext(@CurrentUser() context: RequestContext) {
    return withTenantContext(this.pool, context.tenantId, async (client) => {
      const result = await client.query<{ databaseTenantId: string | null; freightCount: string }>(
        "select current_setting('app.tenant_id', true) as \"databaseTenantId\", count(*)::text as \"freightCount\" from public.freights",
      );
      return {
        authenticated: true,
        requestTenantId: context.tenantId,
        databaseTenantId: result.rows[0]?.databaseTenantId ?? null,
        freightCount: Number(result.rows[0]?.freightCount ?? 0),
      };
    });
  }

  @Get("runtime-rls-isolation")
  @RequirePermission("freight:read")
  async runtimeRlsIsolation(@CurrentUser() context: RequestContext) {
    return withTenantContext(this.pool, context.tenantId, async (client) => {
      const tenantA = context.tenantId;
      const tenantB = randomUUID();
      const probe = await client.query<{ id: string }>(
        "select id from public.freights order by created_at asc limit 1",
      );
      const probeFreightId = probe.rows[0]?.id ?? null;

      if (!probeFreightId) {
        return {
          authenticated: true,
          tenantA,
          syntheticTenantB: tenantB,
          probeFreightId: null,
          tenantAVisible: false,
          tenantBVisible: false,
          rlsIsolation: false,
          reason: "No freight available for the production RLS probe",
        };
      }

      await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantB]);
      const hidden = await client.query(
        "select id from public.freights where id = $1",
        [probeFreightId],
      );

      return {
        authenticated: true,
        tenantA,
        syntheticTenantB: tenantB,
        probeFreightId,
        tenantAVisible: true,
        tenantBVisible: hidden.rowCount === 1,
        rlsIsolation: hidden.rowCount === 0,
      };
    });
  }

  @Get("runtime-auth-claims")
  @RequirePermission("freight:read")
  runtimeAuthClaims(@CurrentUser() context: RequestContext) {
    return {
      authenticated: true,
      issuer: context.oidc?.issuer ?? null,
      audience: context.oidc?.audience ?? null,
      subject: context.oidc?.subject ?? null,
      expiresAt: context.oidc?.expiresAt ?? null,
      tenantId: context.tenantId,
    };
  }

  @Delete(":id")\n  @RequirePermission("freight:delete")\n  remove(\n    @CurrentUser() context: RequestContext,\n    @Param("id", new ParseUUIDPipe()) id: string,\n  ) {\n    return this.service.remove(context, id);\n  }\n\n  @Get(":id")
  @RequirePermission("freight:read")
  get(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(context, id);
  }

  @Get(":id/matches")
  @RequirePermission("matching:read")
  matches(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.matching.rank(context, id);
  }

  @Post(":id/assignment")
  @RequirePermission("matching:assign")
  assign(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: AssignFreightDto,
  ) {
    return this.assignments.assign(context, id, dto.driverId, dto.vehicleId);
  }

  @Post(":id/status-events/:eventId/replay")
  @RequirePermission("freight:update")
  replayStatusChangedEvent(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
  ) {
    return this.service.replayStatusChangedEvent(context, id, eventId);
  }

  @Patch(":id/status")
  @RequirePermission("freight:update")
  updateStatus(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFreightStatusDto,
  ) {
    return this.service.updateStatus(context, id, dto);
  }
}
