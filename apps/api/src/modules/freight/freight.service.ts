import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  PostgresFreightRepository,
  type FreightRow,
  withTenantContext,
} from "@tms/database";
import { canTransitionFreightStatus, type FreightStatus } from "@tms/freight";
import type { Pool } from "pg";
import { DATABASE_POOL } from "../../common/database.provider.js";
import type { RequestContext } from "../../common/request-context.js";
import type {
  CreateFreightDto,
  UpdateFreightStatusDto,
} from "./freight.dto.js";

@Injectable()
export class FreightService {
  private readonly repository: PostgresFreightRepository;

  constructor(@Inject(DATABASE_POOL) pool: Pool) {
    this.repository = new PostgresFreightRepository(pool);
    this.pool = pool;
  }

  private readonly pool: Pool;

  async create(
    context: RequestContext,
    dto: CreateFreightDto,
  ): Promise<FreightRow> {
    return this.repository.createWithAudit(
      {
        tenantId: context.tenantId,
        freightType: dto.freightType,
        originCity: dto.originCity,
        originState: dto.originState.toUpperCase(),
        destinationCity: dto.destinationCity,
        destinationState: dto.destinationState.toUpperCase(),
        cargoDescription: dto.cargoDescription,
        quantity: dto.quantity,
        weightKg: dto.weightKg,
        volumeM3: dto.volumeM3,
        linearMeters: dto.linearMeters,
        customerPriceCents: dto.customerPriceCents,
        driverPriceCents: dto.driverPriceCents,
        vehicleTypes: dto.vehicleTypes,
        bodyTypes: dto.bodyTypes,
        minimumFreeMeters: dto.minimumFreeMeters,
        minimumCapacityKg: dto.minimumCapacityKg,
      },
      {
        actorUserId: context.userId,
        action: "freight.created",
        entityType: "freight",
        requestId: context.requestId,
        afterState: { status: "draft", freightType: dto.freightType },
      },
    );
  }

  list(context: RequestContext): Promise<readonly FreightRow[]> {
    return this.repository.list(context.tenantId);
  }

  async remove(context: RequestContext, freightId: string): Promise<{ id: string; deleted: true }> {\n    const deleted = await this.repository.deleteWithAudit(freightId, context.tenantId, {\n      actorUserId: context.userId,\n      action: "freight.deleted",\n      entityType: "freight",\n      requestId: context.requestId,\n      correlationId: context.correlationId,\n    });\n    if (!deleted) throw new NotFoundException("Freight not found");\n    return { id: freightId, deleted: true };\n  }\n\n  async get(context: RequestContext, freightId: string): Promise<FreightRow> {
    const freight = await this.repository.findById(context.tenantId, freightId);
    if (!freight) throw new NotFoundException("Freight not found");
    return freight;
  }

  async updateStatus(
    context: RequestContext,
    freightId: string,
    dto: UpdateFreightStatusDto,
  ): Promise<FreightRow> {
    const current = await this.repository.findById(context.tenantId, freightId);
    if (!current) throw new NotFoundException("Freight not found");

    const currentStatus = current.status as FreightStatus;
    if (!canTransitionFreightStatus(currentStatus, dto.status)) {
      throw new ConflictException(
        `Invalid freight status transition: ${currentStatus} -> ${dto.status}`,
      );
    }

    try {
      const updated = await this.repository.updateStatusWithAudit(
        context.tenantId,
        freightId,
        currentStatus,
        dto.status,
        {
          actorUserId: context.userId,
          action: "freight.status_changed",
          entityType: "freight",
          requestId: context.requestId,
          correlationId: context.correlationId,
          beforeState: { status: currentStatus },
          afterState: { status: dto.status },
        },
      );
      if (!updated) {
        throw new ConflictException("Freight was changed by another request");
      }

      return updated;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof Error &&
        error.message ===
          "Freight cannot be delivered without an active assignment"
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async replayStatusChangedEvent(
    context: RequestContext,
    freightId: string,
    eventId: string,
  ): Promise<{
    eventId: string;
    durableJobId: string;
    idempotencyKey: string;
    status: string;
  }> {
    return withTenantContext(this.pool, context.tenantId, async (client) => {
      const eventResult = await client.query<{
        id: string;
        tenant_id: string;
        aggregate_id: string | null;
        event_type: string;
        payload: Record<string, unknown>;
      }>(
        `select id, tenant_id, aggregate_id, event_type, payload
         from outbox_events
         where tenant_id = $1
           and id = $2
           and aggregate_type = 'freight'
         limit 1`,
        [context.tenantId, eventId],
      );

      const event = eventResult.rows[0];
      if (!event || event.aggregate_id !== freightId || event.event_type !== "freight.status_changed") {
        throw new NotFoundException("Freight status-change event not found");
      }

      const payload = event.payload;
      if (payload.event_id !== eventId || payload.freight_id !== freightId) {
        throw new ConflictException("Freight status-change event payload is inconsistent");
      }

      const idempotencyKey = `replay:${eventId}:${randomUUID()}`;
      const jobResult = await client.query<{ id: string; status: string }>(
        `insert into durable_jobs
          (tenant_id, job_type, payload, available_at, max_attempts, idempotency_key)
         values ($1, 'freight.status_changed', $2::jsonb, now(), 5, $3)
         returning id, status`,
        [context.tenantId, JSON.stringify(payload), idempotencyKey],
      );

      const job = jobResult.rows[0];
      if (!job) throw new Error("DURABLE_JOB_REPLAY_ENQUEUE_FAILED");

      await client.query(
        `insert into audit_events (
          tenant_id, actor_user_id, action, entity_type, entity_id,
          request_id, correlation_id, outcome, metadata
        ) values ($1,$2,'durable_job.replay_requested','freight',$3,$4,$5,'success',$6::jsonb)`,
        [
          context.tenantId,
          context.userId,
          freightId,
          context.requestId || null,
          context.correlationId || null,
          JSON.stringify({
            event_id: eventId,
            durable_job_id: job.id,
            idempotency_key: idempotencyKey,
            reason: "controlled_production_replay",
          }),
        ],
      );

      return {
        eventId,
        durableJobId: job.id,
        idempotencyKey,
        status: job.status,
      };
    });
  }
}
