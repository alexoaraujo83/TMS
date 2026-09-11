import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Reflector } from '@nestjs/common';
import { hasPermission } from '@tms/security';
import type { RequestContext } from './request-context.js';

export const REQUIRED_PERMISSION = 'required_permission';

interface RequestLike {
  context?: RequestContext;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_PERMISSION, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (!permission) return true;

    const request = executionContext.switchToHttp().getRequest<RequestLike>();
    const context = request.context;
    if (!context || !hasPermission({
      userId: context.userId,
      tenantId: context.tenantId,
      roles: context.roles,
      permissions: context.permissions,
    }, permission)) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
