export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export interface AuthorizationContext { userId: string; tenantId: string; roles: readonly string[]; permissions: readonly string[]; }

export function hasPermission(context: AuthorizationContext, permission: string): boolean {
  return context.permissions.includes('*') || context.permissions.includes(permission);
}

export function requirePermission(context: AuthorizationContext, permission: string): void {
  if (!hasPermission(context, permission)) throw new Error('Forbidden');
}

export function assertSafeIdentifier(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error('Invalid identifier');
  return value;
}
