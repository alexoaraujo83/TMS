export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId: string;
  tenantId: string;
  roles: readonly string[];
  permissions: readonly string[];
  oidc?: {
    issuer: string;
    audience: string | string[];
    subject: string;
    expiresAt?: number;
  };
}

export const REQUEST_CONTEXT = Symbol("REQUEST_CONTEXT");
