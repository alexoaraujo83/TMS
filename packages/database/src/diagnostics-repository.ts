import type { Pool } from "pg";
import { assertUuid } from "./query.js";
import { withTenantContext } from "./tenant-transaction.js";

export type DiagnosticLookup =
  | { kind: "correlationId"; value: string }
  | { kind: "requestId"; value: string }
  | { kind: "outboxEventId"; value: string }
  | { kind: "outboxAggregateId"; value: string }
  | { kind: "durableJobId"; value: string }
  | { kind: "idempotencyKey"; value: string }
  | { kind: "freightId"; value: string };

export interface DiagnosticRecord {
  source: "audit_events" | "outbox_events" | "durable_jobs";
  recordId: string;
  occurredAt: string;
  correlationKey: string | null;
  status: string | null;
  summary: string;
}

export interface DiagnosticQueryResult {
  status: "success" | "no_results";
  sourceCoverage: {
    auditEvents: "queried" | "not_applicable";
    outboxEvents: "queried" | "not_applicable";
    durableJobs: "queried" | "not_applicable";
  };
  records: DiagnosticRecord[];
}

const MAX_RESULTS = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const UUID_LOOKUP_KINDS = new Set<DiagnosticLookup["kind"]>([
  "outboxEventId",
  "outboxAggregateId",
  "durableJobId",
  "freightId",
]);

function validateLookup(lookup: DiagnosticLookup): void {
  if (
    !lookup ||
    typeof lookup.value !== "string" ||
    !lookup.value.trim() ||
    lookup.value.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(lookup.value)
  ) {
    throw new Error("INVALID_DIAGNOSTIC_LOOKUP");
  }
  if (UUID_LOOKUP_KINDS.has(lookup.kind) && !UUID_PATTERN.test(lookup.value)) {
    throw new Error("INVALID_DIAGNOSTIC_LOOKUP");
  }
}

type Row = {
  id: string;
  created_at: Date | string;
  updated_at?: Date | string | null;
  correlation_id?: string | null;
  outcome?: string | null;
  action?: string | null;
  entity_type?: string | null;
  event_type?: string | null;
  aggregate_id?: string | null;
  status?: string | null;
  job_type?: string | null;
};

function toRecord(
  source: DiagnosticRecord["source"],
  row: Row,
  summary: string,
  correlationKey: string | null,
): DiagnosticRecord {
  const occurredAt = source === "durable_jobs"
    ? (row.updated_at ?? row.created_at)
    : row.created_at;
  return {
    source,
    recordId: String(row.id),
    occurredAt: new Date(occurredAt).toISOString(),
    correlationKey,
    status: row.outcome ?? row.status ?? null,
    summary: summary.slice(0, 140),
  };
}

export class DiagnosticsRepository {
  constructor(private readonly pool: Pool) {}

  async search(
    tenantId: string,
    lookup: DiagnosticLookup,
    limit = 25,
  ): Promise<DiagnosticQueryResult> {
    assertUuid(tenantId, "tenantId");
    validateLookup(lookup);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
      throw new Error("INVALID_DIAGNOSTIC_LIMIT");
    }

    return withTenantContext(this.pool, tenantId, async (client) => {
      const records: DiagnosticRecord[] = [];
      const sourceCoverage: DiagnosticQueryResult["sourceCoverage"] = {
        auditEvents: "not_applicable",
        outboxEvents: "not_applicable",
        durableJobs: "not_applicable",
      };

      if (lookup.kind === "correlationId" || lookup.kind === "requestId") {
        sourceCoverage.auditEvents = "queried";
        const column = lookup.kind === "correlationId" ? "correlation_id" : "request_id";
        const result = await client.query<Row>(
          "select id::text as id, created_at, correlation_id, outcome, action, entity_type " +
            "from audit_events where tenant_id = $1 and " + column + " = $2 " +
            "order by created_at desc limit $3",
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push(
            toRecord(
              "audit_events",
              row,
              String(row.action ?? "audit event") + " (" + String(row.entity_type ?? "unknown") + ")",
              row.correlation_id ?? null,
            ),
          );
        }
      }

      if (lookup.kind === "outboxEventId" || lookup.kind === "outboxAggregateId") {
        sourceCoverage.outboxEvents = "queried";
        const column = lookup.kind === "outboxEventId" ? "id" : "aggregate_id";
        const result = await client.query<Row>(
          "select id::text as id, created_at, event_type, status, aggregate_id " +
            "from outbox_events where tenant_id = $1 and " + column + " = $2 " +
            "order by created_at desc limit $3",
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push(
            toRecord("outbox_events", row, String(row.event_type ?? "outbox event"), row.aggregate_id ?? null),
          );
        }
      }

      if (lookup.kind === "durableJobId" || lookup.kind === "idempotencyKey") {
        sourceCoverage.durableJobs = "queried";
        const column = lookup.kind === "durableJobId" ? "id" : "idempotency_key";
        const result = await client.query<Row>(
          "select id::text as id, created_at, updated_at, job_type, status " +
            "from durable_jobs where tenant_id = $1 and " + column + " = $2 " +
            "order by created_at desc limit $3",
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push(toRecord("durable_jobs", row, String(row.job_type ?? "durable job"), null));
        }
      }

      if (lookup.kind === "freightId") {
        sourceCoverage.auditEvents = "queried";
        sourceCoverage.outboxEvents = "queried";
        const auditResult = await client.query<Row>(
          "select id::text as id, created_at, correlation_id, outcome, action, entity_type " +
            "from audit_events where tenant_id = $1 and entity_id = $2 " +
            "order by created_at desc limit $3",
          [tenantId, lookup.value, limit],
        );
        for (const row of auditResult.rows) {
          records.push(
            toRecord(
              "audit_events",
              row,
              String(row.action ?? "audit event") + " (" + String(row.entity_type ?? "unknown") + ")",
              row.correlation_id ?? null,
            ),
          );
        }

        const outboxResult = await client.query<Row>(
          "select id::text as id, created_at, event_type, status, aggregate_id " +
            "from outbox_events where tenant_id = $1 and aggregate_id = $2 " +
            "order by created_at desc limit $3",
          [tenantId, lookup.value, limit],
        );
        for (const row of outboxResult.rows) {
          records.push(
            toRecord("outbox_events", row, String(row.event_type ?? "outbox event"), row.aggregate_id ?? null),
          );
        }
      }

      records.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      const boundedRecords = records.slice(0, limit);
      return {
        status: boundedRecords.length > 0 ? "success" : "no_results",
        sourceCoverage,
        records: boundedRecords,
      };
    });
  }
}
