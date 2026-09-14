import type { Pool, PoolClient } from "pg";

export async function withTenantTransaction<T>(
  pool: Pool,
  tenantId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!tenantId || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
    throw new Error("Invalid tenant identifier");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config($1, $2, true)", [
      "app.tenant_id",
      tenantId,
    ]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
