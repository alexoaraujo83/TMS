import type { Pool } from "pg";
import { assertUuid } from "./query.js";
import { withTenantContext } from "./tenant-transaction.js";

export type DiagnosticLookup =
  | { kind: "correlationId"; value: string }
  | { kind: "requestId"; value: string }
  | { kind: "outboxEventId"; value: string }
  | { kind: "outboxAggregateId"; value: string }
  | { kind: "durableJobId"; value: string };

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

function validateLookup(lookup: DiagnosticLookup): void {
  if (!lookup.value || lookup.value.length > 200 || /[\u0000-\u001f\u007f]/.test(lookup.value)) {
    throw new Error("INVALID_DIAGNOSTIC_LOOKUP");
  }
  if (["outboxEventId", "outboxAggregateId", "durableJobId"].includes(lookup.kind)) {
    assertUuid(lookup.value, "lookup.value");
  }
}

export class DiagnosticsRepository {
  constructor(private readonly pool: Pool) {}

  async search(tenantId: string, lookup: DiagnosticLookup, limit = 25): Promise<DiagnosticQueryResult> {
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
        const result = await client.query(
          `select id, created_at, correlation_id, outcome, action, entity_type
           from audit_events
           where tenant_id = $1 and ${column} = $2
           order by created_at desc limit $3`,
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push({
            source: "audit_events",
            recordId: row.id,
            occurredAt: new Date(row.created_at).toISOString(),
            correlationKey: row.correlation_id,
            status: row.outcome,
            summary: `${String(row.action).slice(0, 80)} (${String(row.entity_type).slice(0, 60)})`,
          });
        }
      }

      if (lookup.kind === "outboxEventId" || lookup.kind === "outboxAggregateId") {
        sourceCoverage.outboxEvents = "queried";
        const column = lookup.kind === "outboxEventId" ? "id" : "aggregate_id";
        const result = await client.query(
          `select id, created_at, event_type, status, aggregate_id
           from outbox_events
           where tenant_id = $1 and ${column} = $2
           order by created_at desc limit $3`,
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push({
            source: "outbox_events",
            recordId: row.id,
            occurredAt: new Date(row.created_at).toISOString(),
            correlationKey: row.aggregate_id,
            status: row.status,
            summary: String(row.event_type).slice(0, 120),
          });
        }
      }

      if (lookup.kind === "durableJobId") {
        sourceCoverage.durableJobs = "queried";
        const result = await client.query(
          `select id, created_at, updated_at, job_type, status, completed_at
           from durable_jobs
           where tenant_id = $1 and id = $2
           order by created_at desc limit $3`,
          [tenantId, lookup.value, limit],
        );
        for (const row of result.rows) {
          records.push({
            source: "durable_jobs",
            recordId: row.id,
            occurredAt: new Date(row.updated_at ?? row.created_at).toISOString(),
            correlationKey: null,
            status: row.status,
            summary: String(row.job_type).slice(0, 120),
          });
        }
      }

      records.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      return {
        status: records.length ? "success" : "no_results",
        sourceCoverage,
        records: records.slice(0, limit),
      };
    });
  }
}
