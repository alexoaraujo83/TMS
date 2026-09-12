import type { Pool } from "pg";
import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { assertUuid } from "./query.js";
import { withTransaction } from "./transaction.js";

export type ComplianceStatus = "pending" | "approved" | "rejected" | "expired";
export type GrStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

const COMPLIANCE_COLUMNS = `id, tenant_id as "tenantId", freight_id as "freightId",
  assignment_id as "assignmentId", check_type as "checkType", status, provider,
  external_reference as "externalReference", metadata, checked_at as "checkedAt",
  expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"`;

const GR_COLUMNS = `id, tenant_id as "tenantId", freight_id as "freightId",
  assignment_id as "assignmentId", status, provider, protocol,
  external_reference as "externalReference", metadata,
  submitted_at as "submittedAt", approved_at as "approvedAt",
  rejected_at as "rejectedAt", expires_at as "expiresAt",
  created_at as "createdAt", updated_at as "updatedAt"`;

export class ComplianceRepository {
  constructor(private readonly pool: Pool) {}

  async createCheck(
    input: {
      tenantId: string;
      freightId: string;
      assignmentId?: string | null;
      checkType: string;
      provider?: string | null;
      externalReference?: string | null;
      metadata?: Record<string, unknown>;
      expiresAt?: Date | null;
    },
    audit: AuditInput,
  ) {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.freightId, "freightId");
    if (input.assignmentId) assertUuid(input.assignmentId, "assignmentId");
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      const freight = await client.query("select id from freights where tenant_id = $1 and id = $2 for update", [input.tenantId, input.freightId]);
      if (!freight.rows[0]) throw new Error("Freight not found");
      if (input.assignmentId) {
        const assignment = await client.query("select id from freight_assignments where tenant_id = $1 and id = $2", [input.tenantId, input.assignmentId]);
        if (!assignment.rows[0]) throw new Error("Assignment not found");
      }
      const result = await client.query(`insert into compliance_checks (tenant_id, freight_id, assignment_id, check_type, provider, external_reference, metadata, expires_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning ${COMPLIANCE_COLUMNS}`, [input.tenantId, input.freightId, input.assignmentId ?? null, input.checkType, input.provider ?? null, input.externalReference ?? null, JSON.stringify(input.metadata ?? {}), input.expiresAt ?? null]);
      const record = result.rows[0];
      if (!record) throw new Error("Compliance check creation failed");
      await appendAuditEvent(client, { ...audit, tenantId: input.tenantId, entityId: record.id, action: "compliance.check_created", entityType: "compliance_check", afterState: record });
      return record;
    });
  }

  async listChecks(tenantId: string, freightId?: string) {
    assertUuid(tenantId, "tenantId");
    if (freightId) assertUuid(freightId, "freightId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query(`select ${COMPLIANCE_COLUMNS} from compliance_checks where tenant_id = $1 ${freightId ? "and freight_id = $2" : ""} order by created_at desc`, freightId ? [tenantId, freightId] : [tenantId]);
      return result.rows;
    });
  }

  async transitionCheck(tenantId: string, id: string, expected: ComplianceStatus, next: ComplianceStatus, audit: AuditInput) {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const current = await client.query(`select ${COMPLIANCE_COLUMNS} from compliance_checks where tenant_id = $1 and id = $2 for update`, [tenantId, id]);
      const row = current.rows[0];
      if (!row) throw new Error("Compliance check not found");
      if (row.status !== expected) throw new Error(`Compliance status ${row.status} does not match expected status ${expected}`);
      if (!isAllowedComplianceTransition(expected, next)) throw new Error(`Compliance check cannot transition from ${expected} to ${next}`);
      const result = await client.query(`update compliance_checks set status = $3, checked_at = now() where tenant_id = $1 and id = $2 and status = $4 returning ${COMPLIANCE_COLUMNS}`, [tenantId, id, next, expected]);
      const updated = result.rows[0];
      if (!updated) throw new Error("Compliance check transition failed");
      await appendAuditEvent(client, { ...audit, tenantId, entityId: id, action: "compliance.check_status_changed", entityType: "compliance_check", beforeState: { status: expected }, afterState: { status: next } });
      return updated;
    });
  }

  async createGr(input: { tenantId: string; freightId: string; assignmentId?: string | null; provider?: string | null; protocol?: string | null; externalReference?: string | null; metadata?: Record<string, unknown>; expiresAt?: Date | null }, audit: AuditInput) {
    assertUuid(input.tenantId, "tenantId");
    assertUuid(input.freightId, "freightId");
    if (input.assignmentId) assertUuid(input.assignmentId, "assignmentId");
    return withTransaction(this.pool, { tenantId: input.tenantId }, async (client) => {
      const freight = await client.query("select id from freights where tenant_id = $1 and id = $2 for update", [input.tenantId, input.freightId]);
      if (!freight.rows[0]) throw new Error("Freight not found");
      const result = await client.query(`insert into gr_requests (tenant_id, freight_id, assignment_id, provider, protocol, external_reference, metadata, expires_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning ${GR_COLUMNS}`, [input.tenantId, input.freightId, input.assignmentId ?? null, input.provider ?? null, input.protocol ?? null, input.externalReference ?? null, JSON.stringify(input.metadata ?? {}), input.expiresAt ?? null]);
      const record = result.rows[0];
      if (!record) throw new Error("GR request creation failed");
      await appendAuditEvent(client, { ...audit, tenantId: input.tenantId, entityId: record.id, action: "compliance.gr_created", entityType: "gr_request", afterState: record });
      return record;
    });
  }

  async listGr(tenantId: string, freightId?: string) {
    assertUuid(tenantId, "tenantId");
    if (freightId) assertUuid(freightId, "freightId");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const result = await client.query(`select ${GR_COLUMNS} from gr_requests where tenant_id = $1 ${freightId ? "and freight_id = $2" : ""} order by created_at desc`, freightId ? [tenantId, freightId] : [tenantId]);
      return result.rows;
    });
  }

  async transitionGr(tenantId: string, id: string, expected: GrStatus, next: GrStatus, audit: AuditInput) {
    assertUuid(tenantId, "tenantId");
    assertUuid(id, "id");
    return withTransaction(this.pool, { tenantId }, async (client) => {
      const current = await client.query(`select ${GR_COLUMNS} from gr_requests where tenant_id = $1 and id = $2 for update`, [tenantId, id]);
      const row = current.rows[0];
      if (!row) throw new Error("GR request not found");
      if (row.status !== expected) throw new Error(`GR status ${row.status} does not match expected status ${expected}`);
      if (!isAllowedGrTransition(expected, next)) throw new Error(`GR request cannot transition from ${expected} to ${next}`);
      const result = await client.query(`update gr_requests set status = $3, submitted_at = case when $3 = 'submitted' and submitted_at is null then now() else submitted_at end, approved_at = case when $3 = 'approved' then now() else approved_at end, rejected_at = case when $3 = 'rejected' then now() else rejected_at end where tenant_id = $1 and id = $2 and status = $4 returning ${GR_COLUMNS}`, [tenantId, id, next, expected]);
      const updated = result.rows[0];
      if (!updated) throw new Error("GR request transition failed");
      await appendAuditEvent(client, { ...audit, tenantId, entityId: id, action: "compliance.gr_status_changed", entityType: "gr_request", beforeState: { status: expected }, afterState: { status: next } });
      return updated;
    });
  }
}

function isAllowedComplianceTransition(from: ComplianceStatus, to: ComplianceStatus) {
  return (from === "pending" && ["approved", "rejected", "expired"].includes(to)) || (from === "approved" && to === "expired");
}

function isAllowedGrTransition(from: GrStatus, to: GrStatus) {
  return (from === "pending" && to === "submitted") || (from === "submitted" && ["approved", "rejected", "expired", "cancelled"].includes(to)) || (from === "approved" && to === "expired");
}
