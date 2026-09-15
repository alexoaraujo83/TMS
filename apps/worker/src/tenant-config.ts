import type { Pool } from "pg";

export async function assertConfiguredTenantsAreActive(
  pool: Pool,
  tenantIds: string[],
): Promise<void> {
  if (tenantIds.length === 0) return;

  const client = await pool.connect();
  const invalidTenantIds: string[] = [];

  try {
    for (const tenantId of tenantIds) {
      await client.query("begin");
      try {
        await client.query("select set_config($1, $2, true)", [
          "app.tenant_id",
          tenantId,
        ]);
        const result = await client.query<{ id: string }>(
          `
            select id::text as id
            from public.tenants
            where id = $1
              and status = 'active'
          `,
          [tenantId],
        );

        if (!result.rows[0]) {
          invalidTenantIds.push(tenantId);
        }

        await client.query("rollback");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
  }

  if (invalidTenantIds.length > 0) {
    throw new Error(
      `INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS_NOT_ACTIVE:${invalidTenantIds.join(",")}`,
    );
  }
}
