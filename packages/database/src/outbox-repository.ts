import { withTenantContext } from "./tenant-transaction.js";

export type OutboxEventStatus = "pending" | "published" | "failed";

export interface OutboxEventRecord {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  availableAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueOutboxEventInput {
  tenantId: string;
  aggregateType: string;
  aggregateId?: string;
  eventType: string;
  payload?: Record<string, unknown>;
  availableAt?: Date;
}

export class OutboxRepository {
  constructor(private readonly pool: any) {}

  async enqueue(input: EnqueueOutboxEventInput): Promise<OutboxEventRecord> {
    return withTenantContext(this.pool, input.tenantId, async (client: any) => {
      const result = await client.query(
        `insert into outbox_events
          (tenant_id, aggregate_type, aggregate_id, event_type, payload, available_at)
         values ($1, $2, $3, $4, $5, coalesce($6, now()))
         returning id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
           status, attempts, available_at, published_at, last_error, created_at, updated_at`,
        [
          input.tenantId,
          input.aggregateType,
          input.aggregateId ?? null,
          input.eventType,
          JSON.stringify(input.payload ?? {}),
          input.availableAt ?? null,
        ],
      );
      return this.map(result.rows[0]);
    });
  }

  async listPending(tenantId: string, limit = 50): Promise<OutboxEventRecord[]> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const result = await client.query(
        `select id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
          status, attempts, available_at, published_at, last_error, created_at, updated_at
         from outbox_events
         where tenant_id = $1 and status = 'pending' and available_at <= now()
         order by created_at asc
         limit $2`,
        [tenantId, limit],
      );
      return result.rows.map((row: any) => this.map(row));
    });
  }

  async markPublished(tenantId: string, id: string): Promise<OutboxEventRecord> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const result = await client.query(
        `update outbox_events
         set status = 'published', published_at = now(), last_error = null
         where tenant_id = $1 and id = $2 and status = 'pending'
         returning id, tenant_id, aggregate_type, aggregate_id, event_type, payload,
           status, attempts, available_at, published_at, last_error, created_at, updated_at`,
        [tenantId, id],
      );
      if (!result.rows[0]) throw new Error("OUTBOX_EVENT_NOT_PUBLISHABLE");
      return this.map(result.rows[0]);
    });
  }

  private map(row: any): OutboxEventRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload,
      status: row.status,
      attempts: Number(row.attempts),
      availableAt: row.available_at,
      publishedAt: row.published_at,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
