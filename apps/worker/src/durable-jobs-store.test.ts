import assert from "node:assert/strict";
import test from "node:test";
import { PgDurableJobStore } from "./durable-jobs-store.js";

test("claimPending excludes jobs that already exhausted attempts", async () => {
  let queryText = "";
  let queryParams: unknown[] = [];
  const pool = {
    connect: async () => ({
      query: async (text: string, params?: unknown[]) => {
        queryText = text;
        queryParams = params ?? [];
        if (text === "BEGIN" || text === "COMMIT") return { rows: [] };
        return { rows: [] };
      },
      release: () => undefined,
    }),
  } as never;

  const store = new PgDurableJobStore(pool);
  const jobs = await store.claimPending(
    "00000000-0000-0000-0000-000000000001",
    50,
  );

  assert.deepEqual(jobs, []);
  assert.match(queryText, /attempts < max_attempts/);
  assert.deepEqual(queryParams, [
    "00000000-0000-0000-0000-000000000001",
    50,
  ]);
});
