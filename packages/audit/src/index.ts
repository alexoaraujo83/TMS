import type { TenantContext } from '@tms/tenancy';

export type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'permission_denied';

export interface AuditEvent { tenantId: string; actorUserId: string; action: AuditAction; resource: string; resourceId?: string; requestId?: string; metadata?: Record<string, unknown>; occurredAt: Date; }

export function createAuditEvent(context: TenantContext, event: Omit<AuditEvent, 'tenantId' | 'actorUserId' | 'occurredAt'>): AuditEvent {
  return { ...event, tenantId: context.tenantId, actorUserId: context.userId, occurredAt: new Date() };
}
