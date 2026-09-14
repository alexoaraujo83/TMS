import type { Pool, PoolClient } from "pg";

export async function withTenantContext<T>(
  client: Pool | PoolClient,
  tenantId: string,
  work?: (client: PoolClient) => Promise<T>,
): Promise<T | void> {
  if (!tenantId || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
    throw new Error("Invalid tenant identifier");
  }

  await client.query("select set_config($1, $2, true)", [
    "app.tenant_id",
    tenantId,
  ]);

  if (work) return work(client as PoolClient);
}
