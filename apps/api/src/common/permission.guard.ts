import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { hasPermission } from '@tms/security';
import type { RequestContext } from './request-context.js';

export const REQUIRED_PERMISSION = Symbol('REQUIRED_PERMISSION');

interface RequestLike {
  context?: RequestContext;
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly permission?: string) {}

  canActivate(executionContext: ExecutionContext): boolean {
    if (!this.permission) return true;
    const request = executionContext.switchToHttp().getRequest<RequestLike>();
    const context = request.context;
    if (!context || !hasPermission({ ...context }, this.permission)) {
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
