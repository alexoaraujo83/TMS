export const DATABASE_SCHEMA_VERSION = 1;

export interface TenantScopedRecord {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RLS_CONTEXT_KEY = 'app.tenant_id';

export function tenantSessionSql(tenantId: string): string {
  const escaped = tenantId.replaceAll("'", "''");
  return `select set_config('${RLS_CONTEXT_KEY}', '${escaped}', true)`;
}
