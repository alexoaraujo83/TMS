import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiError } from './api-error.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const tenantId = request.headers['x-tenant-id'];

    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new ApiError('TENANT_CONTEXT_REQUIRED', 'Tenant context is required', 401);
    }

    return true;
  }
}
