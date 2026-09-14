import type { Pool } from "pg";
import type { OutboxEvent, OutboxStore } from "./outbox-worker.js";

export class PgOutboxStore implements OutboxStore {
  constructor(private readonly pool: Pool) {}

  async claimPending(
    tenantId: string,
    limit: number,
  ): Promise<OutboxEvent[]> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query(
        `with claimed as (
           select id
           from outbox_events
           where tenant_id = $1
             and status = 'pending'
             and available_at <= now()
           order by created_at asc
           for update skip locked
           limit $2
         )
         update outbox_events as event
         set attempts = event.attempts + 1,
             available_at = now() + interval '5 minutes',
             updated_at = now()
         from claimed
         where event.id = claimed.id
         returning event.id, event.tenant_id, event.aggregate_type,
           event.aggregate_id, event.event_type, event.payload, event.attempts`,
        [tenantId, limit],
      );
      await client.query("commit");
      return result.rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        aggregateType: String(row.aggregate_type),
        aggregateId: row.aggregate_id ? String(row.aggregate_id) : null,
        eventType: String(row.event_type),
        payload: row.payload as Record<string, unknown>,
        attempts: Number(row.attempts),
      }));
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async markPublished(tenantId: string, id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query(
        `update outbox_events
         set status = 'published', published_at = now(), last_error = null,
             updated_at = now()
         where tenant_id = $1 and id = $2 and status = 'pending'
         returning id`,
        [tenantId, id],
      );
      if (!result.rows[0]) {
        throw new Error("OUTBOX_EVENT_NOT_PUBLISHABLE");
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailed(
    tenantId: string,
    id: string,
    error: string,
    retryAt: Date,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("select set_config($1, $2, true)", [
        "app.tenant_id",
        tenantId,
      ]);
      const result = await client.query(
        `update outbox_events
         set status = case when attempts >= 5 then 'failed' else 'pending' end,
             available_at = case when attempts >= 5 then available_at else $4 end,
             last_error = $3,
             updated_at = now()
         where tenant_id = $1 and id = $2 and status = 'pending'
         returning id`,
        [tenantId, id, error.slice(0, 4000), retryAt],
      );
      if (!result.rows[0]) {
        throw new Error("OUTBOX_EVENT_NOT_FAILABLE");
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}
