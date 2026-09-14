import assert from "node:assert/strict";
import test from "node:test";
import { PgDurableJobStore } from "./durable-jobs-store.js";

test("claimPending excludes jobs that already exhausted attempts", async () => {
  const queries: string[] = [];
  const pool = {
    connect: async () => ({
      query: async (text: string) => {
        queries.push(text);
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
  assert.ok(queries.some((query) => /attempts < max_attempts/.test(query)));
});
