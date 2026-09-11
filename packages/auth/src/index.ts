import type { TenantContext } from '@tms/tenancy';

export interface AuthClaims { sub: string; tenantId: string; roles: readonly string[]; permissions: readonly string[]; issuer: string; audience: string; }

export interface AuthenticatedRequestContext extends TenantContext { permissions: readonly string[]; }

export function claimsToContext(claims: AuthClaims): AuthenticatedRequestContext {
  if (!claims.sub || !claims.tenantId) throw new Error('Invalid authentication claims');
  return { userId: claims.sub, tenantId: claims.tenantId, roles: claims.roles, permissions: claims.permissions };
}
