import type { TenantContext } from "@tms/tenancy";

export interface Membership {
  tenantId: string;
  userId: string;
  role: string;
  permissions: readonly string[];
  active: boolean;
}

export function assertTenantMembership(
  context: TenantContext,
  membership: Membership | null,
): Membership {
  if (!membership || !membership.active)
    throw new Error("Tenant membership required");
  if (
    membership.userId !== context.userId ||
    membership.tenantId !== context.tenantId
  ) {
    throw new Error("Tenant membership mismatch");
  }
  return membership;
}

export function hasMembershipPermission(
  membership: Membership,
  permission: string,
): boolean {
  return (
    membership.permissions.includes("*") ||
    membership.permissions.includes(permission)
  );
}

export function requireMembershipPermission(
  membership: Membership,
  permission: string,
): void {
  if (!hasMembershipPermission(membership, permission))
    throw new Error("Forbidden");
}
