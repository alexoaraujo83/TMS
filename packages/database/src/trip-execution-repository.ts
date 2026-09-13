import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export const occurrenceTypes = [
  "delay",
  "accident",
  "breakdown",
  "cargo_damage",
  "refusal",
  "address_issue",
  "other",
] as const;
export const occurrenceSeverities = ["info", "warning", "critical"] as const;
export type TripOccurrenceType = (typeof occurrenceTypes)[number];
export type TripOccurrenceSeverity = (typeof occurrenceSeverities)[number];

export interface TripOccurrenceRecord {
  id: string;
  tenantId: string;
  tripId: string;
  type: TripOccurrenceType;
  severity: TripOccurrenceSeverity;
  description: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TripPodRecord {
  id: string;
  tenantId: string;
  tripId: string;
  recipientName: string;
  receivedAt: Date;
  documentRef: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOccurrenceInput {
  type: TripOccurrenceType;
  severity: TripOccurrenceSeverity;
  description: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreatePodInput {
  recipientName: string;
  receivedAt: Date;
  documentRef: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

const OCCURRENCE_COLUMNS = `id,
  tenant_id as "tenantId",
  trip_id as "tripId",
  type,
  severity,
  description,
  occurred_at as "occurredAt",
  metadata,
  created_by as "createdBy",
  created_at as "createdAt",
  updated_at as "updatedAt"`;

const POD_COLUMNS = `id,
  tenant_id as "tenantId",
  trip_id as "tripId",
  recipient_name as "recipientName",
  received_at as "receivedAt",
  document_ref as "documentRef",
  notes,
  metadata,
  created_by as "createdBy",
  created_at as "createdAt",
  updated_at as "updatedAt"`;

export class TripExecutionRepository {
  constructor(private readonly pool: Pool) {}

  async createOccurrence(tenantId: string, tripId: string, input: CreateOccurrenceInput, audit: AuditInput) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const trip = await client.query(`select id from trips where tenant_id = $1 and id = $2`, [tenantId, tripId]);
      if (!trip.rows[0]) throw new Error("Trip not found");
      const result = await client.query<TripOccurrenceRecord>(
        `insert into trip_occurrences (tenant_id, trip_id, type, severity, description, occurred_at, metadata, created_by)
         values ($1, $2, $3, $4, $5, coalesce($6, now()), $7, $8)
         returning ${OCCURRENCE_COLUMNS}`,
        [tenantId, tripId, input.type, input.severity, input.description, input.occurredAt ?? null, JSON.stringify(input.metadata ?? {}), audit.actorUserId],
      );
      const occurrence = result.rows[0];
      if (!occurrence) throw new Error("Occurrence creation failed");
      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: occurrence.id,
        action: "trip.occurrence_created",
        entityType: "trip_occurrence",
        afterState: { tripId, type: input.type, severity: input.severity },
      });
      return occurrence;
    });
  }

  async listOccurrences(tenantId: string, tripId: string) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query<TripOccurrenceRecord>(
        `select ${OCCURRENCE_COLUMNS} from trip_occurrences where tenant_id = $1 and trip_id = $2 order by occurred_at desc, id desc`,
        [tenantId, tripId],
      );
      return result.rows;
    });
  }

  async createPod(tenantId: string, tripId: string, input: CreatePodInput, audit: AuditInput) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const trip = await client.query<{ status: string }>(
        `select status from trips where tenant_id = $1 and id = $2 for update`,
        [tenantId, tripId],
      );
      if (!trip.rows[0]) throw new Error("Trip not found");
      if (trip.rows[0].status !== "delivered") throw new Error("POD requires a delivered trip");
      const existing = await client.query(`select id from trip_pods where tenant_id = $1 and trip_id = $2`, [tenantId, tripId]);
      if (existing.rows[0]) throw new Error("POD already exists for trip");
      const result = await client.query<TripPodRecord>(
        `insert into trip_pods (tenant_id, trip_id, recipient_name, received_at, document_ref, notes, metadata, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning ${POD_COLUMNS}`,
        [tenantId, tripId, input.recipientName, input.receivedAt, input.documentRef, input.notes ?? null, JSON.stringify(input.metadata ?? {}), audit.actorUserId],
      );
      const pod = result.rows[0];
      if (!pod) throw new Error("POD creation failed");
      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: pod.id,
        action: "trip.pod_created",
        entityType: "trip_pod",
        afterState: { tripId, recipientName: input.recipientName, receivedAt: input.receivedAt.toISOString(), documentRef: input.documentRef },
      });
      return pod;
    });
  }

  async getPod(tenantId: string, tripId: string) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, async (client) => {
      const result = await client.query<TripPodRecord>(
        `select ${POD_COLUMNS} from trip_pods where tenant_id = $1 and trip_id = $2 limit 1`,
        [tenantId, tripId],
      );
      return result.rows[0] ?? null;
    }, { tenantId });
  }

  async listTimeline(tenantId: string, tripId: string) {
    assertUuid(tenantId, "tenantId");
    assertUuid(tripId, "tripId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const trip = await client.query(
        `select id from trips where tenant_id = $1 and id = $2`,
        [tenantId, tripId],
      );
      if (!trip.rows[0]) throw new Error("Trip not found");
      const result = await client.query(
        `with events as (
          select created_at as at, 'trip.created' as type, 'Trip created' as description, null::uuid as entity_id from trips where tenant_id = $1 and id = $2
          union all select started_at, 'trip.started', 'Trip started', null::uuid from trips where tenant_id = $1 and id = $2 and started_at is not null
          union all select delivered_at, 'trip.delivered', 'Trip delivered', null::uuid from trips where tenant_id = $1 and id = $2 and delivered_at is not null
          union all select cancelled_at, 'trip.cancelled', 'Trip cancelled', null::uuid from trips where tenant_id = $1 and id = $2 and cancelled_at is not null
          union all select occurred_at, 'trip.occurrence', type || ': ' || description, id from trip_occurrences where tenant_id = $1 and trip_id = $2
          union all select received_at, 'trip.pod', 'Proof of delivery received from ' || recipient_name, id from trip_pods where tenant_id = $1 and trip_id = $2
        ) select at, type, description, entity_id as "entityId" from events order by at asc, type asc`,
        [tenantId, tripId],
      );
      return result.rows;
    });
  }
}
