import { appendAuditEvent, type AuditEventInput } from "./audit-repository.js";
import { withTenantContext } from "./tenant-transaction.js";

type AuditInput = Omit<AuditEventInput, "tenantId" | "entityId">;

export type FinancialDirection = "receivable" | "payable";
export type FinancialEntryStatus = "pending" | "settled" | "cancelled";
export type FinancialEntryType =
  | "freight"
  | "carrier"
  | "driver"
  | "fee"
  | "commission"
  | "adjustment";

export interface FinancialEntryRecord {
  id: string;
  tenantId: string;
  freightId: string;
  assignmentId: string | null;
  tripId: string | null;
  direction: FinancialDirection;
  entryType: FinancialEntryType;
  description: string;
  amountCents: number;
  currency: string;
  status: FinancialEntryStatus;
  dueAt: Date | null;
  settledAt: Date | null;
  externalReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFinancialEntryInput {
  tenantId: string;
  freightId: string;
  assignmentId?: string;
  tripId?: string;
  direction: FinancialDirection;
  entryType: FinancialEntryType;
  description: string;
  amountCents: number;
  currency?: string;
  dueAt?: Date;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}

export class FinanceRepository {
  constructor(private readonly pool: any) {}

  async create(
    input: CreateFinancialEntryInput,
    audit: AuditInput,
  ): Promise<FinancialEntryRecord> {
    return withTenantContext(this.pool, input.tenantId, async (client: any) => {
      if (input.assignmentId) {
        const assignment = await client.query(
          `select id from freight_assignments
           where tenant_id = $1 and id = $2 and freight_id = $3`,
          [input.tenantId, input.assignmentId, input.freightId],
        );
        if (!assignment.rows[0]) {
          throw new Error("Assignment does not belong to freight");
        }
      }

      if (input.tripId) {
        const trip = await client.query(
          `select id, assignment_id from trips
           where tenant_id = $1 and id = $2 and freight_id = $3`,
          [input.tenantId, input.tripId, input.freightId],
        );
        if (!trip.rows[0]) {
          throw new Error("Trip does not belong to freight");
        }
        if (input.assignmentId && trip.rows[0].assignment_id !== input.assignmentId) {
          throw new Error("Trip does not belong to assignment");
        }
      }

      const result = await client.query(
        `insert into financial_entries
          (tenant_id, freight_id, assignment_id, trip_id, direction, entry_type,
           description, amount_cents, currency, due_at, external_reference, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id, tenant_id, freight_id, assignment_id, trip_id, direction,
           entry_type, description, amount_cents, currency, status, due_at,
           settled_at, external_reference, metadata, created_at, updated_at`,
        [
          input.tenantId,
          input.freightId,
          input.assignmentId ?? null,
          input.tripId ?? null,
          input.direction,
          input.entryType,
          input.description,
          input.amountCents,
          input.currency ?? "BRL",
          input.dueAt ?? null,
          input.externalReference ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      const entry = this.map(result.rows[0]);
      await appendAuditEvent(client, {
        ...audit,
        tenantId: input.tenantId,
        entityId: entry.id,
        action: "finance.entry_created",
        entityType: "financial_entry",
        afterState: entry,
      });
      return entry;
    });
  }

  async settle(
    tenantId: string,
    id: string,
    audit: AuditInput,
  ): Promise<FinancialEntryRecord> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const current = await client.query(
        `select id, tenant_id, freight_id, assignment_id, trip_id, direction,
          entry_type, description, amount_cents, currency, status, due_at,
          settled_at, external_reference, metadata, created_at, updated_at
         from financial_entries
         where tenant_id = $1 and id = $2
         for update`,
        [tenantId, id],
      );
      const before = current.rows[0];
      if (!before || before.status !== "pending") {
        throw new Error("FINANCIAL_ENTRY_NOT_SETTLEABLE");
      }

      const result = await client.query(
        `update financial_entries
         set status = 'settled', settled_at = now()
         where tenant_id = $1 and id = $2 and status = 'pending'
         returning id, tenant_id, freight_id, assignment_id, trip_id, direction,
           entry_type, description, amount_cents, currency, status, due_at,
           settled_at, external_reference, metadata, created_at, updated_at`,
        [tenantId, id],
      );
      if (!result.rows[0]) throw new Error("FINANCIAL_ENTRY_NOT_SETTLEABLE");
      const entry = this.map(result.rows[0]);
      await appendAuditEvent(client, {
        ...audit,
        tenantId,
        entityId: id,
        action: "finance.entry_settled",
        entityType: "financial_entry",
        beforeState: before,
        afterState: entry,
      });
      return entry;
    });
  }

  async listByFreight(
    tenantId: string,
    freightId: string,
  ): Promise<FinancialEntryRecord[]> {
    return withTenantContext(this.pool, tenantId, async (client: any) => {
      const result = await client.query(
        `select id, tenant_id, freight_id, assignment_id, trip_id, direction,
          entry_type, description, amount_cents, currency, status, due_at,
          settled_at, external_reference, metadata, created_at, updated_at
         from financial_entries where tenant_id = $1 and freight_id = $2
         order by created_at desc`,
        [tenantId, freightId],
      );
      return result.rows.map((row: any) => this.map(row));
    });
  }

  private map(row: any): FinancialEntryRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      freightId: row.freight_id,
      assignmentId: row.assignment_id,
      tripId: row.trip_id,
      direction: row.direction,
      entryType: row.entry_type,
      description: row.description,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      status: row.status,
      dueAt: row.due_at,
      settledAt: row.settled_at,
      externalReference: row.external_reference,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
