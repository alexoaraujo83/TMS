import type { Pool, PoolClient } from "pg";
import { withTransaction } from "./transaction.js";

export async function withTenantContext<T>(
  pool: Pool,
  tenantId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, { tenantId }, work);
}
