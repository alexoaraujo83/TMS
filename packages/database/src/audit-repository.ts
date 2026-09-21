import type { Pool, PoolClient } from "pg";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export interface AuditEventInput {
  tenantId: string;
  actorUserId?: string;
  actorSubject?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  outcome?: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
}

export async function appendAuditEvent(client: PoolClient, input: AuditEventInput): Promise<void> {
  assertUuid(input.tenantId, "tenantId");
  if (input.actorUserId) assertUuid(input.actorUserId, "actorUserId");
  if (input.entityId) assertUuid(input.entityId, "entityId");

  await client.query(
    `insert into audit_events (
      tenant_id, actor_user_id, actor_subject, action, entity_type, entity_id,
      request_id, correlation_id, ip_address, user_agent, outcome,
      before_state, after_state, metadata
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::inet,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb)`,
    [
      input.tenantId, input.actorUserId ?? null, input.actorSubject ?? null,
      input.action, input.entityType, input.entityId ?? null,
      input.requestId ?? null, input.correlationId ?? null, input.ipAddress ?? null,
      input.userAgent ?? null, input.outcome ?? null,
      JSON.stringify(input.beforeState ?? null), JSON.stringify(input.afterState ?? null),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export class AuditRepository {
  constructor(private readonly pool: Pool) {}
  async append(input: AuditEventInput): Promise<void> {
    await withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      await appendAuditEvent(client, input);
    });
  }
}
