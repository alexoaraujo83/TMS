import type { Pool, PoolClient } from "pg";

export interface TransactionOptions {
  tenantId: string;
}

function assertTenantId(tenantId: string): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(tenantId))
    throw new Error("Invalid tenant identifier");
}

export async function withTransaction<T>(
  pool: Pool,
  options: TransactionOptions,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  assertTenantId(options.tenantId);
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config($1, $2, true)", [
      "app.tenant_id",
      options.tenantId,
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
