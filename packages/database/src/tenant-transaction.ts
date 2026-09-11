export interface TransactionClient {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
}

export async function withTenantContext<T>(
  client: TransactionClient,
  tenantId: string,
  work: (client: TransactionClient) => Promise<T>,
): Promise<T> {
  if (!tenantId || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
    throw new Error('Invalid tenant identifier');
  }

  await client.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId]);
  return work(client);
}
