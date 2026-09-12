export const DATABASE_SCHEMA_VERSION = 19;

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
  ComplianceRepository,
  type ComplianceStatus,
  type GrStatus,
} from "./compliance-repository.js";
export { verifyTenantMembership } from "./membership-bootstrap.js";
export { AuditRepository } from "./audit-repository.js";
export { queryOne, assertUuid } from "./query.js";
