export interface RequestContext {
  requestId: string;
  userId: string;
  tenantId: string;
  roles: readonly string[];
  permissions: readonly string[];
}

export const REQUEST_CONTEXT = Symbol("REQUEST_CONTEXT");
