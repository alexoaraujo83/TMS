import { Pool, type PoolConfig } from "pg";

export interface DatabasePoolOptions extends PoolConfig {
  connectionString: string;
}

export function createDatabasePool(options: DatabasePoolOptions): Pool {
  if (!options.connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({
    ...options,
    max: options.max ?? 10,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
  });
}
