import { randomUUID } from "node:crypto";
import { Pool, PoolClient } from "pg";
import type { AuditEventInput } from "@tms/audit";

export type FreightLifecycle =
  | "draft"
  | "open"
  | "matching"
  | "negotiating"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "cancelled";

export type FreightStatusUpdate = {
  tenantId: string;
  freightId: string;
  nextStatus: FreightLifecycle;
  actorUserId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

export type FreightAuditContext = Omit<
  AuditEventInput,
  "tenantId" | "entityId" | "entityType" | "action" | "beforeState" | "afterState"
>;

export type FreightRepository = {
  updateLifecycle(input: FreightStatusUpdate, audit?: FreightAuditContext): Promise<void>;
};

const terminalStatuses = new Set<FreightLifecycle>(["delivered", "cancelled"]);

const allowedTransitions: Record<FreightLifecycle, FreightLifecycle[]> = {
  draft: ["open", "cancelled"],
  open: ["matching", "cancelled"],
  matching: ["negotiating", "assigned", "cancelled"],
  negotiating: ["assigned", "matching", "cancelled"],
  assigned: ["in_transit", "cancelled"],
  in_transit: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function createFreightRepository(pool: Pool): FreightRepository {
  return {
    async updateLifecycle(input, audit) {
      const { tenantId, freightId, nextStatus } = input;
      const client = await pool.connect();

      try {
        await client.query("begin");
        await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);

        const result = await client.query<{
          status: FreightLifecycle;
          id: string;
        }>(
          `select id, status
             from freights
            where tenant_id = $1 and id = $2
            for update`,
          [tenantId, freightId],
        );

        const row = result.rows[0];
        if (!row) {
          throw new Error("Freight not found");
        }

        if (terminalStatuses.has(row.status)) {
          throw new Error(`Freight lifecycle is already terminal: ${row.status}`);
        }

        if (!allowedTransitions[row.status].includes(nextStatus)) {
          throw new Error(
            `Invalid freight lifecycle transition: ${row.status} -> ${nextStatus}`,
          );
        }

        if (nextStatus === "in_transit" || terminalStatuses.has(nextStatus)) {
          const assignment = await client.query<{ id: string }>(
            `select id
               from freight_assignments
              where tenant_id = $1
                and freight_id = $2
                and status = 'active'
              for update`,
            [tenantId, freightId],
          );

          if (nextStatus === "in_transit" && !assignment.rows[0]) {
            throw new Error("Freight cannot enter transit without an active assignment");
          }

          if (nextStatus === "delivered" && !assignment.rows[0]) {
            throw new Error(
              "Freight cannot be delivered without an active assignment",
            );
          }

          const activeAssignment = assignment.rows[0];
          if (activeAssignment) {
            const assignmentNextStatus =
              nextStatus === "delivered" ? "completed" : "cancelled";
            const timestampColumn =
              assignmentNextStatus === "completed"
                ? "completed_at"
                : "cancelled_at";

            await client.query(
              `update freight_assignments
                  set status = $3, ${timestampColumn} = now(), updated_at = now()
                where tenant_id = $1 and id = $2 and status = 'active'`,
              [tenantId, activeAssignment.id, assignmentNextStatus],
            );

            if (audit) {
              await appendAuditEvent(client, {
                ...audit,
                tenantId,
                action:
                  assignmentNextStatus === "completed"
                    ? "freight.assignment_completed"
                    : "freight.assignment_cancelled",
                entityType: "freight_assignment",
                entityId: activeAssignment.id,
                beforeState: { status: "active", freightId },
                afterState: { status: assignmentNextStatus, freightId },
              });
            }
          }
        }

        await client.query(
          `update freights
              set status = $3, updated_at = now()
            where tenant_id = $1 and id = $2`,
          [tenantId, freightId, nextStatus],
        );

        if (audit) {
          await appendAuditEvent(client, {
            ...audit,
            tenantId,
            entityId: row.id,
            entityType: "freight",
            action: "freight.lifecycle_changed",
            beforeState: { status: row.status },
            afterState: { status: nextStatus },
          });
        }

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

async function appendAuditEvent(
  client: PoolClient,
  event: AuditEventInput,
): Promise<void> {
  await client.query(
    `insert into audit_events (
       id,
       tenant_id,
       actor_user_id,
       request_id,
       action,
       entity_type,
       entity_id,
       before_state,
       after_state,
       metadata,
       created_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
    [
      randomUUID(),
      event.tenantId,
      event.actorUserId ?? null,
      event.requestId ?? null,
      event.action,
      event.entityType,
      event.entityId,
      event.beforeState ?? null,
      event.afterState ?? null,
      event.metadata ?? {},
    ],
  );
}
