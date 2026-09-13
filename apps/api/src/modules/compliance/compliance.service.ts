import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ComplianceRepository,
  type ComplianceStatus,
  type GrStatus,
} from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";
import type {
  CreateComplianceCheckDto,
  CreateGrRequestDto,
  TransitionComplianceDto,
  TransitionGrDto,
} from "./compliance.dto.js";

function mapError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : "Compliance operation failed";

  if (
    message === "Freight not found" ||
    message === "Assignment not found" ||
    message === "Compliance check not found" ||
    message === "GR request not found"
  ) {
    throw new NotFoundException(message);
  }

  if (
    message.includes("does not match expected status") ||
    message.includes("transition failed")
  ) {
    throw new ConflictException(message);
  }

  if (message.includes("cannot transition")) {
    throw new ConflictException(message);
  }

  throw error;
}

@Injectable()
export class ComplianceService {
  private readonly repository: ComplianceRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new ComplianceRepository(pool);
  }

  createCheck(context: RequestContext, dto: CreateComplianceCheckDto) {
    return this.repository
      .createCheck(
        { tenantId: context.tenantId, ...dto },
        {
          actorUserId: context.userId,
          action: "compliance.check_created",
          entityType: "compliance_check",
          requestId: context.requestId,
        },
      )
      .catch(mapError);
  }

  listChecks(context: RequestContext, freightId?: string) {
    return this.repository
      .listChecks(context.tenantId, freightId)
      .catch(mapError);
  }

  transitionCheck(
    context: RequestContext,
    id: string,
    dto: TransitionComplianceDto,
  ) {
    return this.repository
      .transitionCheck(
        context.tenantId,
        id,
        dto.expectedStatus as ComplianceStatus,
        dto.nextStatus as ComplianceStatus,
        {
          actorUserId: context.userId,
          action: "compliance.check_status_changed",
          entityType: "compliance_check",
          requestId: context.requestId,
        },
      )
      .catch(mapError);
  }

  createGr(context: RequestContext, dto: CreateGrRequestDto) {
    return this.repository
      .createGr(
        { tenantId: context.tenantId, ...dto },
        {
          actorUserId: context.userId,
          action: "compliance.gr_created",
          entityType: "gr_request",
          requestId: context.requestId,
        },
      )
      .catch(mapError);
  }

  listGr(context: RequestContext, freightId?: string) {
    return this.repository.listGr(context.tenantId, freightId).catch(mapError);
  }

  transitionGr(context: RequestContext, id: string, dto: TransitionGrDto) {
    return this.repository
      .transitionGr(
        context.tenantId,
        id,
        dto.expectedStatus as GrStatus,
        dto.nextStatus as GrStatus,
        {
          actorUserId: context.userId,
          action: "compliance.gr_status_changed",
          entityType: "gr_request",
          requestId: context.requestId,
        },
      )
      .catch(mapError);
  }
}
