export const DATABASE_SCHEMA_VERSION = 29;

export interface TenantScopedRecord {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const RLS_CONTEXT_KEY = "app.tenant_id";

export function tenantSessionSql(tenantId: string): string {
  const escaped = tenantId.replaceAll("'", "''");
  return `select set_config('${RLS_CONTEXT_KEY}', '${escaped}', true)`;
}

export { createDatabasePool } from "./pool.js";
export { withTransaction } from "./transaction.js";
export { withTenantContext } from "./tenant-transaction.js";
export {
  PostgresFreightRepository,
  type CreateFreightInput,
  type FreightRow,
} from "./freight-repository.js";
export {
  CarrierRepository,
  DriverRepository,
  VehicleRepository,
} from "./operational-repositories.js";
export {
  MatchingCandidateRepository,
  type EnrichedMatchingCandidateRecord,
} from "./matching-candidate-repository.js";
export {
  AssignmentRepository,
  type AssignmentResult,
  type FreightAssignmentRecord,
} from "./assignment-repository.js";
export {
  TripRepository,
  type TripRecord,
  type TripStatus,
} from "./trip-repository.js";
export {
  TripExecutionRepository,
  occurrenceTypes,
  occurrenceSeverities,
  type TripOccurrenceType,
  type TripOccurrenceSeverity,
  type TripOccurrenceRecord,
  type TripPodRecord,
  type CreateOccurrenceInput,
  type CreatePodInput,
} from "./trip-execution-repository.js";
export {
  ComplianceRepository,
  type ComplianceStatus,
  type GrStatus,
} from "./compliance-repository.js";
export { assertComplianceRelease } from "./compliance-release.js";
export {
  FinanceRepository,
  type CreateFinancialEntryInput,
  type FinancialDirection,
  type FinancialEntryRecord,
  type FinancialEntryStatus,
  type FinancialEntryType,
} from "./finance-repository.js";
export {
  OutboxRepository,
  type EnqueueOutboxEventInput,
  type OutboxEventRecord,
  type OutboxEventStatus,
  type OutboxFailureOptions,
} from "./outbox-repository.js";
export {
  DurableJobsRepository,
  type DurableJobRecord,
  type DurableJobStatus,
  type EnqueueDurableJobInput,
} from "./durable-jobs-repository.js";
export { verifyTenantMembership } from "./membership-bootstrap.js";
export { AuditRepository } from "./audit-repository.js";
export { queryOne, assertUuid } from "./query.js";
