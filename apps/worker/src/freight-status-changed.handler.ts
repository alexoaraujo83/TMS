import { withTenantContext, AuditRepository } from "@tms/database";
import type { Pool } from "pg";
import type { DurableJob, DurableJobHandler } from "./durable-jobs-worker.js";

export interface FreightStatusChangedPayload {
  event_id: string;
  freight_id: string;
  from_status: string;
  to_status: string;
  request_id?: string | null;
  correlation_id?: string | null;
  actor_user_id?: string | null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`FREIGHT_STATUS_CHANGED_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function createFreightStatusChangedHandler(
  pool: Pool,
  emit: (event: string, details: Record<string, unknown>) => void,
): DurableJobHandler {
  const audit = new AuditRepository(pool);

  return async (job: DurableJob): Promise<void> => {
    const payload = job.payload as Partial<FreightStatusChangedPayload>;
    const eventId = requireString(payload.event_id, "event_id");
    const freightId = requireString(payload.freight_id, "freight_id");
    const fromStatus = requireString(payload.from_status, "from_status");
    const toStatus = requireString(payload.to_status, "to_status");

    const state = await withTenantContext(pool, job.tenantId, async (client) => {
      const result = await client.query<{ status: string }>(
        "select status from freights where tenant_id = $1 and id = $2 limit 1",
        [job.tenantId, freightId],
      );
      return result.rows[0] ?? null;
    });

    if (!state) throw new Error("FREIGHT_STATUS_CHANGED_FREIGHT_NOT_FOUND");
    if (state.status !== toStatus) {
      throw new Error(
        `FREIGHT_STATUS_CHANGED_STATE_MISMATCH:${state.status}->${toStatus}`,
      );
    }

    const alreadyAudited = await withTenantContext(pool, job.tenantId, async (client) => {
      const result = await client.query<{ exists: boolean }>(
        `select exists (
           select 1
           from audit_events
           where tenant_id = $1
             and action = 'freight.status_changed.processed'
             and metadata->>'event_id' = $2
         ) as exists`,
        [job.tenantId, eventId],
      );
      return Boolean(result.rows[0]?.exists);
    });

    if (!alreadyAudited) {
      await audit.append({
        tenantId: job.tenantId,
        actorUserId: payload.actor_user_id ?? undefined,
        action: "freight.status_changed.processed",
        entityType: "freight",
        entityId: freightId,
        requestId: payload.request_id ?? undefined,
        correlationId: payload.correlation_id ?? undefined,
        outcome: "success",
        beforeState: { status: fromStatus },
        afterState: { status: toStatus },
        metadata: {
          event_id: eventId,
          durable_job_id: job.id,
          handler: "freight-status-changed.handler",
        },
      });
    }

    emit("freight.status_changed.handled", {
      event_id: eventId,
      durable_job_id: job.id,
      freight_id: freightId,
      from_status: fromStatus,
      to_status: toStatus,
      tenant_id: job.tenantId,
      idempotent_replay: alreadyAudited,
    });
  };
}
