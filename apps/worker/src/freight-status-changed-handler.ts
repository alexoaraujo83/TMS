import type { Pool } from "pg";
import type { DurableJob, DurableJobHandler } from "./durable-jobs-worker.js";

type FreightStatus =
  | "draft"
  | "open"
  | "matching"
  | "negotiating"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "cancelled";

interface FreightStatusChangedPayload {
  freightId: string;
  expectedStatus: FreightStatus;
  nextStatus: FreightStatus;
  eventId?: string;
  actorUserId?: string;
  requestId?: string;
}

const TRANSITIONS: Readonly<Record<FreightStatus, readonly FreightStatus[]>> = {
  draft: ["open", "cancelled"],
  open: ["matching", "cancelled"],
  matching: ["negotiating", "open", "cancelled"],
  negotiating: ["assigned", "matching", "cancelled"],
  assigned: ["in_transit", "cancelled"],
  in_transit: ["delivered"],
  delivered: [],
  cancelled: [],
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function parsePayload(job: DurableJob): FreightStatusChangedPayload {
  const payload = job.payload;
  if (!isUuid(payload.freightId)) {
    throw new Error("DURABLE_JOB_FREIGHT_ID_INVALID");
  }

  const expectedStatus = payload.expectedStatus;
  const nextStatus = payload.nextStatus;
  if (
    typeof expectedStatus !== "string" ||
    typeof nextStatus !== "string" ||
    !Object.hasOwn(TRANSITIONS, expectedStatus) ||
    !Object.hasOwn(TRANSITIONS, nextStatus)
  ) {
    throw new Error("DURABLE_JOB_FREIGHT_STATUS_INVALID");
  }

  const eventId = payload.eventId;
  const actorUserId = payload.actorUserId;
  const requestId = payload.requestId;
  if (eventId !== undefined && typeof eventId !== "string") {
    throw new Error("DURABLE_JOB_EVENT_ID_INVALID");
  }
  if (actorUserId !== undefined && !isUuid(actorUserId)) {
    throw new Error("DURABLE_JOB_ACTOR_INVALID");
  }
  if (requestId !== undefined && typeof requestId !== "string") {
    throw new Error("DURABLE_JOB_REQUEST_ID_INVALID");
  }

  return {
    freightId: payload.freightId,
    expectedStatus: expectedStatus as FreightStatus,
    nextStatus: nextStatus as FreightStatus,
    eventId,
    actorUserId,
    requestId,
  };
}

export function createFreightStatusChangedHandler(pool: Pool): DurableJobHandler {
  return async (job) => {
    const payload = parsePayload(job);
    const allowed = TRANSITIONS[payload.expectedStatus].includes(
      payload.nextStatus,
    );
    if (!allowed) {
      throw new Error(
        `DURABLE_JOB_FREIGHT_TRANSITION_INVALID:${payload.expectedStatus}->${payload.nextStatus}`,
      );
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.tenant_id', $1, true)", [
        job.tenantId,
      ]);

      const currentResult = await client.query<{ status: FreightStatus }>(
        "select status from freights where id = $1 and tenant_id = $2 for update",
        [payload.freightId, job.tenantId],
      );
      const current = currentResult.rows[0];
      if (!current) {
        throw new Error("DURABLE_JOB_FREIGHT_NOT_FOUND");
      }

      if (current.status === payload.nextStatus) {
        await client.query("commit");
        return;
      }

      if (current.status !== payload.expectedStatus) {
        throw new Error(
          `DURABLE_JOB_FREIGHT_STATUS_CONFLICT:${current.status}->${payload.nextStatus}`,
        );
      }

      const updated = await client.query<{ id: string }>(
        `update freights
            set status = $3, updated_at = now()
          where id = $1 and tenant_id = $2 and status = $4
          returning id`,
        [
          payload.freightId,
          job.tenantId,
          payload.nextStatus,
          payload.expectedStatus,
        ],
      );
      if (!updated.rows[0]) {
        throw new Error("DURABLE_JOB_FREIGHT_UPDATE_CONFLICT");
      }

      await client.query(
        `insert into audit_events (
           tenant_id,
           actor_user_id,
           action,
           entity_type,
           entity_id,
           request_id,
           before_state,
           after_state,
           metadata
         ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)`,
        [
          job.tenantId,
          payload.actorUserId ?? null,
          "freight.status_changed",
          "freight",
          payload.freightId,
          payload.requestId ?? null,
          JSON.stringify({ status: payload.expectedStatus }),
          JSON.stringify({ status: payload.nextStatus }),
          JSON.stringify({
            durableJobId: job.id,
            eventId: payload.eventId ?? null,
            handler: "freight.status.changed",
          }),
        ],
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
}
