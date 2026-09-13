import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ApiError } from "./api-error.js";
import type { RequestContext } from "./request-context.js";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  context?: RequestContext;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const tenantId = request.headers["x-tenant-id"];
    const requestContext = request.context;

    if (!requestContext?.tenantId || !requestContext.userId) {
      throw new ApiError(
        "TENANT_CONTEXT_REQUIRED",
        "Authenticated tenant context is required",
        401,
      );
    }

    if (typeof tenantId === "string" && tenantId !== requestContext.tenantId) {
      throw new ApiError(
        "TENANT_CONTEXT_MISMATCH",
        "Tenant context does not match the authenticated context",
        403,
      );
    }

    return true;
  }
}
