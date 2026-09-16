import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pool, PoolClient } from "pg";
import { withTenantContext } from "../src/tenant-transaction.js";

const tenantId = "11111111-1111-4111-8111-111111111111";

function createFakePool() {
  const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
  const client = {
    async query<T>(sql: string, params?: readonly unknown[]) {
      queries.push({ sql, params });
      return [] as readonly T[];
    },
    release() {},
  } as unknown as PoolClient;

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  return { pool, client, queries };
}

describe("withTenantContext", () => {
  it("binds tenant context inside an explicit transaction and commits", async () => {
    const { pool, client, queries } = createFakePool();

    const result = await withTenantContext(pool, tenantId, async (transactionClient) => {
      assert.equal(transactionClient, client);
      return "ok";
    });

    assert.equal(result, "ok");
    assert.deepEqual(
      queries.map(({ sql }) => sql),
      [
        "begin",
        "select set_config($1, $2, true)",
        "commit",
      ],
    );
    assert.deepEqual(queries[1]?.params, ["app.tenant_id", tenantId]);
  });

  it("rolls back when the tenant-scoped operation fails", async () => {
    const { pool, queries } = createFakePool();
    const failure = new Error("operation failed");

    await assert.rejects(
      withTenantContext(pool, tenantId, async () => {
        throw failure;
      }),
      failure,
    );

    assert.deepEqual(
      queries.map(({ sql }) => sql),
      [
        "begin",
        "select set_config($1, $2, true)",
        "rollback",
      ],
    );
  });

  it("rejects invalid tenant identifiers before opening a connection", async () => {
    const { pool, queries } = createFakePool();

    await assert.rejects(
      withTenantContext(pool, "not-a-uuid", async () => undefined),
      /Invalid tenant identifier/,
    );

    assert.deepEqual(queries, []);
  });
});
