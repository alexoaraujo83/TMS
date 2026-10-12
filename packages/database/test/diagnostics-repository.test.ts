import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Pool, PoolClient } from "pg";
import { DiagnosticsRepository } from "../src/diagnostics-repository.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = "2026-10-10T12:00:00.000Z";

type Call = { sql: string; params?: readonly unknown[] };
type Row = Record<string, unknown>;
type Responder = (sql: string, params?: readonly unknown[]) => Row[];

function fakePool(responder: Responder = () => []) {
  const calls: Call[] = [];
  const client = {
    async query(sql: string, params?: readonly unknown[]) {
      calls.push({ sql, params });
      if (sql.startsWith("begin") || sql === "commit" || sql === "rollback" || sql.startsWith("select set_config")) {
        return { rows: [], rowCount: 0 };
      }
      const rows = responder(sql, params);
      return { rows, rowCount: rows.length };
    },
    release() {},
  } as unknown as PoolClient;
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;
  return { pool, calls };
}

const auditRow = {
  id: EVENT_ID,
  created_at: CREATED_AT,
  correlation_id: "corr-123",
  outcome: "success",
  action: "freight.status_changed",
  entity_type: "freight",
};

describe("DiagnosticsRepository", () => {
  it("returns no_results for a valid query that has no matches", async () => {
    const { pool, calls } = fakePool();
    const repository = new DiagnosticsRepository(pool);

    const result = await repository.search(TENANT_A, { kind: "correlationId", value: "missing-correlation" });

    assert.equal(result.status, "no_results");
    assert.deepEqual(result.records, []);
    assert.equal(result.sourceCoverage.auditEvents, "queried");
    const sourceQuery = calls.find((call) => call.sql.includes("from audit_events"));
    assert.ok(sourceQuery);
    assert.match(sourceQuery.sql, /tenant_id = \$1/);
    assert.deepEqual(sourceQuery.params, [TENANT_A, "missing-correlation", 25]);
    assert.ok(calls.some((call) => call.sql.startsWith("select set_config") && call.params?.[1] === TENANT_A));
  });

  it("accepts a limit of 50 and rejects zero, fractions, and values above 50", async () => {
    const { pool, calls } = fakePool();
    const repository = new DiagnosticsRepository(pool);

    await repository.search(TENANT_A, { kind: "correlationId", value: "corr-123" }, 50);
    const sourceQuery = calls.find((call) => call.sql.includes("from audit_events"));
    assert.equal(sourceQuery?.params?.[2], 50);
    await assert.rejects(repository.search(TENANT_A, { kind: "correlationId", value: "corr-123" }, 0), /INVALID_DIAGNOSTIC_LIMIT/);
    await assert.rejects(repository.search(TENANT_A, { kind: "correlationId", value: "corr-123" }, 1.5), /INVALID_DIAGNOSTIC_LIMIT/);
    await assert.rejects(repository.search(TENANT_A, { kind: "correlationId", value: "corr-123" }, 51), /INVALID_DIAGNOSTIC_LIMIT/);
  });

  it("rejects blank, oversized, control-character, and malformed UUID lookups before connecting", async () => {
    const { pool, calls } = fakePool();
    const repository = new DiagnosticsRepository(pool);

    await assert.rejects(repository.search(TENANT_A, { kind: "requestId", value: "   " }), /INVALID_DIAGNOSTIC_LOOKUP/);
    await assert.rejects(repository.search(TENANT_A, { kind: "requestId", value: "x".repeat(201) }), /INVALID_DIAGNOSTIC_LOOKUP/);
    await assert.rejects(repository.search(TENANT_A, { kind: "correlationId", value: "corr\n123" }), /INVALID_DIAGNOSTIC_LOOKUP/);
    await assert.rejects(repository.search(TENANT_A, { kind: "outboxEventId", value: "not-a-uuid" }), /INVALID_DIAGNOSTIC_LOOKUP/);
    assert.deepEqual(calls, []);
  });

  it("binds the verified tenant and never returns rows scoped to a different tenant", async () => {
    const { pool, calls } = fakePool((sql, params) => {
      if (sql.includes("from audit_events") && params?.[0] === TENANT_A) return [auditRow];
      if (sql.includes("from audit_events") && params?.[0] === TENANT_B) return [];
      return [];
    });
    const repository = new DiagnosticsRepository(pool);

    const tenantAResult = await repository.search(TENANT_A, { kind: "correlationId", value: "corr-123" });
    const tenantBResult = await repository.search(TENANT_B, { kind: "correlationId", value: "corr-123" });

    assert.equal(tenantAResult.records.length, 1);
    assert.equal(tenantBResult.status, "no_results");
    assert.equal(tenantBResult.records.length, 0);
    const sourceCalls = calls.filter((call) => call.sql.includes("from audit_events"));
    assert.deepEqual(sourceCalls.map((call) => call.params?.[0]), [TENANT_A, TENANT_B]);
    assert.ok(sourceCalls.every((call) => /tenant_id = \$1/.test(call.sql)));
  });

  it("maps the durable-job idempotency key only to the existing migration-backed column", async () => {
    const { pool, calls } = fakePool();
    const repository = new DiagnosticsRepository(pool);

    await repository.search(TENANT_A, { kind: "idempotencyKey", value: "freight-event:123" });
    const sourceQuery = calls.find((call) => call.sql.includes("from durable_jobs"));
    assert.ok(sourceQuery);
    assert.match(sourceQuery.sql, /idempotency_key = \$2/);
    assert.deepEqual(sourceQuery.params, [TENANT_A, "freight-event:123", 25]);
  });

  it("propagates source query failures instead of reporting a false empty result", async () => {
    const { pool } = fakePool((sql) => {
      if (sql.includes("from audit_events")) throw Object.assign(new Error("query failed"), { code: "42P01" });
      return [];
    });
    const repository = new DiagnosticsRepository(pool);

    await assert.rejects(repository.search(TENANT_A, { kind: "requestId", value: "req-123" }));
  });
});
