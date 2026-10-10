import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { DiagnosticLookup } from "@tms/database";
import { AuthGuard } from "../../common/auth.guard.js";
import { CurrentUser } from "../../common/current-user.decorator.js";
import { PermissionGuard } from "../../common/permission.guard.js";
import { RequirePermission } from "../../common/permission.decorator.js";
import type { RequestContext } from "../../common/request-context.js";
import { DiagnosticsService } from "./diagnostics.service.js";

const LOOKUP_KINDS = new Set<DiagnosticLookup["kind"]>([
  "requestId",
  "correlationId",
  "outboxEventId",
  "outboxAggregateId",
  "durableJobId",
  "idempotencyKey",
  "freightId",
]);
const UUID_KINDS = new Set<DiagnosticLookup["kind"]>([
  "outboxEventId",
  "outboxAggregateId",
  "durableJobId",
  "freightId",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_RESULTS = 50;

@Controller("admin")
@UseGuards(AuthGuard, PermissionGuard)
export class DiagnosticsController {
  constructor(private readonly service: DiagnosticsService) {}

  @Get("diagnostics")
  @RequirePermission("ops:diagnostics")
  search(
    @CurrentUser() context: RequestContext,
    @Query("kind") kindValue?: string,
    @Query("value") rawValue?: string,
    @Query("limit") rawLimit?: string,
  ) {
    if (!kindValue || !LOOKUP_KINDS.has(kindValue as DiagnosticLookup["kind"])) {
      throw new BadRequestException("Unsupported diagnostic identifier kind");
    }

    const value = rawValue?.trim();
    if (!value || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new BadRequestException("Invalid diagnostic identifier value");
    }

    const kind = kindValue as DiagnosticLookup["kind"];
    if (UUID_KINDS.has(kind) && !UUID_PATTERN.test(value)) {
      throw new BadRequestException("Diagnostic identifier must be a UUID");
    }

    const limit = rawLimit === undefined ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
      throw new BadRequestException("Diagnostic limit must be an integer between 1 and 50");
    }

    const lookup: DiagnosticLookup = { kind, value } as DiagnosticLookup;
    return this.service.search(context.tenantId, lookup, limit);
  }
}
