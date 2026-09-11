import { jwtVerify } from 'jose';
import type { TenantContext } from '@tms/tenancy';

export interface AuthClaims {
  sub: string;
  tenantId: string;
  roles: readonly string[];
  permissions: readonly string[];
  issuer: string;
  audience: string;
}

export interface AuthenticatedRequestContext extends TenantContext {
  permissions: readonly string[];
}

export function claimsToContext(claims: AuthClaims): AuthenticatedRequestContext {
  if (!claims.sub || !claims.tenantId) throw new Error('Invalid authentication claims');
  return { userId: claims.sub, tenantId: claims.tenantId, roles: claims.roles, permissions: claims.permissions };
}

export interface JwtVerifierConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export async function verifyAccessToken(token: string, config: JwtVerifierConfig): Promise<AuthClaims> {
  if (!token || token.length > 8192) throw new Error('Invalid access token');

  const { payload } = await jwtVerify(token, new TextEncoder().encode(config.secret), {
    algorithms: ['HS256'],
    issuer: config.issuer,
    audience: config.audience,
  });

  const tenantId = typeof payload.tenantId === 'string' ? payload.tenantId : '';
  const roles = Array.isArray(payload.roles) ? payload.roles.filter((value): value is string => typeof value === 'string') : [];
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions.filter((value): value is string => typeof value === 'string')
    : [];

  if (typeof payload.sub !== 'string' || !tenantId) throw new Error('Invalid authentication claims');

  return {
    sub: payload.sub,
    tenantId,
    roles,
    permissions,
    issuer: config.issuer,
    audience: config.audience,
  };
}
