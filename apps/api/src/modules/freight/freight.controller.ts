import { randomUUID } from "node:crypto";
import {
  Body,
  Controller,
  Delete,
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
import { CreateFreightDto, UpdateFreightDto, UpdateFreightStatusDto } from "./freight.dto.js";
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
  @RequirePermission("ops:diagnostics")
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
  @RequirePermission("ops:diagnostics")
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
  @RequirePermission("ops:diagnostics")
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

  @Get("runtime-rls-evidence")
  @RequirePermission("ops:diagnostics")
  async runtimeRlsEvidence(@CurrentUser() context: RequestContext) {
    return withTenantContext(this.pool, context.tenantId, async (client) => {
      const identity = await client.query<{
        currentUser: string;
        bypassRls: boolean;
        superuser: boolean;
      }>(
        `select current_user as "currentUser",
                r.rolbypassrls as "bypassRls",
                r.rolsuper as "superuser"
         from pg_roles r
         where r.rolname = current_user`,
      );

      const role = identity.rows[0];
      const own = await client.query<{ id: string }>(
        "select id from public.freights order by created_at asc limit 1",
      );
      const ownFreightId = own.rows[0]?.id ?? null;

      if (!ownFreightId) {
        return {
          generatedAt: new Date().toISOString(),
          authenticated: true,
          tenantId: context.tenantId,
          session: {
            currentUser: role?.currentUser ?? null,
            rolbypassrls: role?.bypassRls ?? null,
            rolsuper: role?.superuser ?? null,
          },
          checks: {
            ownTenantSelect: { passed: false, detail: "No freight available for the runtime probe" },
            crossTenantSelect: { passed: false, detail: "No freight available for the runtime probe" },
            crossTenantInsert: { passed: false, detail: "No fixture available" },
            crossTenantUpdate: { passed: false, detail: "No fixture available" },
            rollbackGuard: { passed: true, detail: "No write was attempted because the probe had no fixture" },
          },
          overall: false,
        };
      }

      const ownVisible = await client.query(
        "select id, tenant_id from public.freights where id = $1",
        [ownFreightId],
      );

      const tenantB = randomUUID();
      await client.query("savepoint db04_cross_select");
      await client.query("select set_config($1, $2, true)", ["app.tenant_id", tenantB]);
      const hidden = await client.query(
        "select id from public.freights where id = $1",
        [ownFreightId],
      );
      await client.query("rollback to savepoint db04_cross_select");
      await client.query("select set_config($1, $2, true)", ["app.tenant_id", context.tenantId]);

      await client.query("savepoint db04_cross_insert");
      let insertPassed = false;
      let insertDetail = "cross-tenant INSERT was accepted";
      try {
        await client.query(
          `insert into public.freights
             (id, tenant_id, status, freight_type, origin_city, origin_state,
              destination_city, destination_state, cargo_description, quantity, weight_kg)
           values ($1,$2,'open','dedicated','Santos','SP','São Paulo','SP',
                   'DB-04 evidence probe',1,100)`,
          [randomUUID(), tenantB],
        );
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : "";
        insertPassed = code === "42501";
        insertDetail = insertPassed
          ? "Rejected by PostgreSQL/RLS (SQLSTATE 42501)"
          : "Rejected, but not with SQLSTATE 42501";
      }
      await client.query("rollback to savepoint db04_cross_insert");

      await client.query("savepoint db04_cross_update");
      let updatePassed = false;
      let updateDetail = "cross-tenant tenant_id reassignment was accepted";
      try {
        await client.query(
          "update public.freights set tenant_id = $1 where id = $2",
          [tenantB, ownFreightId],
        );
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : "";
        updatePassed = code === "42501";
        updateDetail = updatePassed
          ? "Rejected by PostgreSQL/RLS (SQLSTATE 42501)"
          : "Rejected, but not with SQLSTATE 42501";
      }
      await client.query("rollback to savepoint db04_cross_update");

      const contextAfterRollback = await client.query<{ tenant: string | null }>(
        "select nullif(current_setting('app.tenant_id', true), '') as tenant",
      );

      const checks = {
        sessionIdentity: {
          passed: role?.currentUser === "tms_app" && role?.bypassRls === false && role?.superuser === false,
          detail: `current_user=${role?.currentUser ?? "unknown"}; rolbypassrls=${String(role?.bypassRls)}; rolsuper=${String(role?.superuser)}`,
        },
        ownTenantSelect: {
          passed: ownVisible.rowCount === 1 && ownVisible.rows[0]?.tenant_id === context.tenantId,
          detail: `visibleRows=${ownVisible.rowCount ?? 0}`,
        },
        crossTenantSelect: {
          passed: hidden.rowCount === 0,
          detail: `visibleRowsAfterSyntheticTenantSwitch=${hidden.rowCount ?? 0}`,
        },
        crossTenantInsert: { passed: insertPassed, detail: insertDetail },
        crossTenantUpdate: { passed: updatePassed, detail: updateDetail },
        rollbackGuard: {
          passed: contextAfterRollback.rows[0]?.tenant === context.tenantId,
          detail: "All mutation probes were isolated behind savepoints and rolled back",
        },
      };

      return {
        generatedAt: new Date().toISOString(),
        authenticated: true,
        tenantId: context.tenantId,
        probeFreightId: ownFreightId,
        syntheticTenantB: tenantB,
        session: {
          currentUser: role?.currentUser ?? null,
          rolbypassrls: role?.bypassRls ?? null,
          rolsuper: role?.superuser ?? null,
        },
        checks,
        overall: Object.values(checks).every((check) => check.passed),
        safety: {
          persistentWrite: false,
          note: "The endpoint only attempts cross-tenant writes and rolls each attempt back to a savepoint.",
        },
      };
    });
  }

  @Get("runtime-auth-claims")
  @RequirePermission("ops:diagnostics")
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

  @Patch(":id")
  @RequirePermission("freight:update")
  update(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFreightDto,
  ) {
    return this.service.update(context, id, dto);
  }

  @Delete(":id")
  @RequirePermission("freight:delete")
  remove(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(context, id);
  }

  @Get(":id")
  @RequirePermission("freight:read")
  get(
    @CurrentUser() context: RequestContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(context, id);
  }

  @Get(":id/status-events")
  @RequirePermission("freight:read")
  statusEvents(@CurrentUser() context: RequestContext, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.service.listStatusEvents(context, id);
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
  @RequirePermission("freight:replay")
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
