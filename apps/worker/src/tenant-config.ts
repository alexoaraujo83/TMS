import type { Pool } from "pg";

export async function assertConfiguredTenantsAreActive(
  pool: Pool,
  tenantIds: string[],
): Promise<void> {
  if (tenantIds.length === 0) return;

  const result = await pool.query<{ id: string }>(
    `
      select id::text as id
      from public.tenants
      where status = 'active'
        and id = any($1::uuid[])
    `,
    [tenantIds],
  );

  const activeTenantIds = new Set(result.rows.map((row) => row.id));
  const invalidTenantIds = tenantIds.filter((tenantId) => !activeTenantIds.has(tenantId));

  if (invalidTenantIds.length > 0) {
    throw new Error(
      `INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS_NOT_ACTIVE:${invalidTenantIds.join(",")}`,
    );
  }
}
