export interface QueryExecutor {
  query<T>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
}

export function assertUuid(value: string, field = 'id'): void {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error(`Invalid ${field}`);
}

export async function queryOne<T>(executor: QueryExecutor, sql: string, params: readonly unknown[] = []): Promise<T | null> {
  const rows = await executor.query<T>(sql, params);
  return rows[0] ?? null;
}
