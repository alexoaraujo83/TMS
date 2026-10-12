export type AccessDecisionReason =
  | "ALLOW"
  | "MEMBERSHIP_REQUIRED"
  | "MEMBERSHIP_INACTIVE"
  | "IDENTITY_MISMATCH"
  | "TENANT_MISMATCH"
  | "RESOURCE_TENANT_MISMATCH"
  | "MISSING_PERMISSION"
  | "INVALID_REQUEST";

export interface AccessMembership {
  userId: string;
  tenantId: string;
  active: boolean;
  permissions: readonly string[];
}

export interface AccessEvaluationInput {
  principalUserId: string;
  tenantId: string;
  permission: string;
  membership: AccessMembership | null;
  resourceTenantId?: string;
}

export interface AccessEvaluation {
  allowed: boolean;
  reason: AccessDecisionReason;
}

/**
 * Evaluate a tenant-scoped permission using authoritative membership data.
 *
 * This pure function is a policy primitive, not a substitute for JWT
 * verification, loading membership from the database, or PostgreSQL RLS.
 * Wildcard permissions are intentionally not interpreted here.
 */
export function evaluateAccess(
  input: AccessEvaluationInput,
): AccessEvaluation {
  if (
    !input.principalUserId.trim() ||
    !input.tenantId.trim() ||
    !input.permission.trim()
  ) {
    return { allowed: false, reason: "INVALID_REQUEST" };
  }

  const membership = input.membership;
  if (!membership) {
    return { allowed: false, reason: "MEMBERSHIP_REQUIRED" };
  }

  if (!membership.active) {
    return { allowed: false, reason: "MEMBERSHIP_INACTIVE" };
  }

  if (membership.userId !== input.principalUserId) {
    return { allowed: false, reason: "IDENTITY_MISMATCH" };
  }

  if (membership.tenantId !== input.tenantId) {
    return { allowed: false, reason: "TENANT_MISMATCH" };
  }

  if (
    input.resourceTenantId !== undefined &&
    input.resourceTenantId !== input.tenantId
  ) {
    return { allowed: false, reason: "RESOURCE_TENANT_MISMATCH" };
  }

  if (!membership.permissions.includes(input.permission)) {
    return { allowed: false, reason: "MISSING_PERMISSION" };
  }

  return { allowed: true, reason: "ALLOW" };
}
