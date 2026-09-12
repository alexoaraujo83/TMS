import type { Pool } from 'pg';
import { assertUuid } from './query.js';
import { withTransaction } from './transaction.js';

export interface AuditEventInput {
  tenantId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId?: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  constructor(private readonly pool: Pool) {}

  async append(input: AuditEventInput): Promise<void> {
    assertUuid(input.tenantId, 'tenantId');
    if (input.actorUserId) assertUuid(input.actorUserId, 'actorUserId');
    if (input.entityId) assertUuid(input.entityId, 'entityId');

    await withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      await client.query(
        `insert into audit_events (
          tenant_id, actor_user_id, action, entity_type, entity_id,
          request_id, before_state, after_state, metadata
        ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)`,
        [
          input.tenantId,
          input.actorUserId ?? null,
          input.action,
          input.entityType,
          input.entityId ?? null,
          input.requestId ?? null,
          JSON.stringify(input.beforeState ?? null),
          JSON.stringify(input.afterState ?? null),
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    });
  }
}
