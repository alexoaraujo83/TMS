export interface TenantContext { tenantId: string; userId: string; roles: readonly string[]; }

export function assertTenantContext(context: TenantContext | null | undefined): asserts context is TenantContext {
  if (!context?.tenantId || !context.userId) throw new Error('Tenant context is required');
}

export function assertSameTenant(expectedTenantId: string, resourceTenantId: string): void {
  if (!expectedTenantId || expectedTenantId !== resourceTenantId) throw new Error('Cross-tenant resource access denied');
}
