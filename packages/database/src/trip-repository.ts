import type { Pool, PoolClient } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export type TripStatus = "planned" | "in_transit" | "delivered" | "cancelled";

export interface TripRecord {
  id: string;
  tenantId: string;
  freightId: string;
  assignmentId: string;
  status: TripStatus;
  startedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

const TRIP_COLUMNS = `id,
  tenant_id as "tenantId",
  freight_id as "freightId",
  assignment_id as "assignmentId",
  status,
  started_at as "startedAt",
  delivered_at as "deliveredAt",
  cancelled_at as "cancelledAt",
  created_at as "createdAt",
  updated_at as "updatedAt"`;

export class TripRepository {
  constructor(private readonly pool: Pool) {}

  async create(tenantId: string, freightId: string, assignmentId: string, audit: AuditInput) {
    assertUuid(tenantId, "tenantId");
    assertUuid(freightId, "freightId");
    assertUuid(assignmentId, "assignmentId");

    return withTransaction(this.pool, { tenantId }, async (client) => {
      const assignment = await client.query<{
        id: string;
        freightId: string;
        status: string;
      }>(
        `select id, freight_id as "freightId", status
           from freight_assignments
          where tenant_id = $1 and id = $2
          for update`,
        [tenantId, assignmentId],
      );
      const row = assignment.rows[0];
      if (!row) throw new Error("Assignment not found");
      if (row.freightId !== freightId) {
        throw new Error("Assignment does not belong to the freight");
      }
      if (row.status !== "active") {
        throw new Error("Only an active assignment can start a trip");
      }

      const freight = await client.query<{ status: string }>(
        `select status from freights where tenant_id = $1 and id = $2 for update`,
        [tenantId, freightId],
      );
      if (!freight.rows[0]) throw new Error("Freight not found");
      if (freight.rows[0].status !== "assigned") {
        throw new Error("Freight must be assigned before trip creation");
      }

      const existing = await client.query<{ id: string }>(
        `select id from trips where tenant_id = $1 and assignment_id = $2 limit 1`,
        [tenantId, assignmentId],
      );
      if (existing.rows[0]) throw new Error("Trip already exists for assignment");

      const result = await client.query<TripRecord>(
        `insert into trips (tenant_id, freight_id, assignment_id)
         values ($1, $2, $3)
         returning ${TRIP_COLUMNS}`,
        [tenantId, freightId, assignmentId],
      );
      const trip = result.rows[0];
      if (!trip) throw new Error("Trip creation failed");

      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: trip.id,
        afterState: { status: trip.status, freightId, assignmentId },
      });
      return trip;
    });
  }

  async findById(tenantId: string, tripId: string): Promise<TripRecord | null> {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<TripRecord>(
        `select ${TRIP_COLUMNS} from trips where tenant_id = $1 and id = $2 limit 1`,
        [tenantId, tripId],
      );
      return result.rows[0] ?? null;
    });
  }

  async list(tenantId: string): Promise<readonly TripRecord[]> {
    assertUuid(tenantId, "tenantId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<TripRecord>(
        `select ${TRIP_COLUMNS} from trips where tenant_id = $1 order by created_at desc`,
        [tenantId],
      );
      return result.rows;
    });
  }

  async transition(
    tenantId: string,
    tripId: string,
    expectedStatus: TripStatus,
    nextStatus: TripStatus,
    audit: AuditInput,
  ) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");

    return withTransaction(this.pool, { tenantId }, async (client) => {
      const tripResult = await client.query<TripRecord>(
        `select ${TRIP_COLUMNS} from trips where tenant_id = $1 and id = $2 for update`,
        [tenantId, tripId],
      );
      const trip = tripResult.rows[0];
      if (!trip) throw new Error("Trip not found");
      if (trip.status !== expectedStatus) {
        throw new Error(
          `Trip status ${trip.status} does not match expected status ${expectedStatus}`,
        );
      }

      const allowed =
        (expectedStatus === "planned" && nextStatus === "in_transit") ||
        (expectedStatus === "in_transit" && nextStatus === "delivered") ||
        (expectedStatus === "planned" && nextStatus === "cancelled") ||
        (expectedStatus === "in_transit" && nextStatus === "cancelled");
      if (!allowed) {
        throw new Error(
          `Trip cannot transition from ${expectedStatus} to ${nextStatus}`,
        );
      }

      const freightExpected =
        nextStatus === "in_transit"
          ? "assigned"
          : expectedStatus === "in_transit"
            ? "in_transit"
            : "assigned";
      const freight = await transitionFreight(
        client,
        tenantId,
        trip.freightId,
        freightExpected,
        nextStatus === "cancelled"
          ? "cancelled"
          : nextStatus === "delivered"
            ? "delivered"
            : "in_transit",
      );

      if (nextStatus === "delivered" || nextStatus === "cancelled") {
        const assignmentNextStatus =
          nextStatus === "delivered" ? "completed" : "cancelled";
        const timestampColumn =
          nextStatus === "delivered" ? "completed_at" : "cancelled_at";
        const assignmentUpdate = await client.query(
          `update freight_assignments
              set status = $3, ${timestampColumn} = now(), updated_at = now()
            where tenant_id = $1 and id = $2 and status = 'active'
            returning id`,
          [tenantId, trip.assignmentId, assignmentNextStatus],
        );
        if (!assignmentUpdate.rows[0]) {
          throw new Error("Trip requires an active assignment");
        }
        await appendAuditEvent(client, {
          ...audit,
          tenantId,
          entityId: trip.assignmentId,
          action:
            nextStatus === "delivered"
              ? "freight.assignment_completed"
              : "freight.assignment_cancelled",
          entityType: "freight_assignment",
          beforeState: { status: "active", freightId: trip.freightId },
          afterState: {
            status: assignmentNextStatus,
            freightId: trip.freightId,
          },
        });
      }

      const result = await client.query<TripRecord>(
        `update trips
            set status = $3,
                started_at = case when $3 = 'in_transit' and started_at is null then now() else started_at end,
                delivered_at = case when $3 = 'delivered' then now() else delivered_at end,
                cancelled_at = case when $3 = 'cancelled' then now() else cancelled_at end
          where tenant_id = $1 and id = $2 and status = $4
          returning ${TRIP_COLUMNS}`,
        [tenantId, tripId, nextStatus, expectedStatus],
      );
      const updated = result.rows[0];
      if (!updated) throw new Error("Trip transition failed");

      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: tripId,
        beforeState: { status: expectedStatus, freightStatus: freight.previousStatus },
        afterState: { status: nextStatus, freightStatus: freight.nextStatus },
      });
      return updated;
    });
  }
}

async function transitionFreight(
  client: PoolClient,
  tenantId: string,
  freightId: string,
  expectedStatus: string,
  nextStatus: string,
) {
  const result = await client.query<{ id: string }>(
    `update freights
        set status = $3
      where tenant_id = $1 and id = $2 and status = $4
      returning id`,
    [tenantId, freightId, nextStatus, expectedStatus],
  );
  if (!result.rows[0]) {
    throw new Error(`Freight cannot transition from ${expectedStatus} to ${nextStatus}`);
  }
  return { previousStatus: expectedStatus, nextStatus };
}
