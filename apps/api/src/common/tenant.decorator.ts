import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RequestContext } from './request-context.js';

interface RequestLike {
  context?: RequestContext;
}

export const TenantContext = createParamDecorator((_data: unknown, context: ExecutionContext): RequestContext => {
  const request = context.switchToHttp().getRequest<RequestLike>();
  if (!request.context?.tenantId || !request.context.userId) {
    throw new UnauthorizedException('Authenticated tenant context required');
  }
  return request.context;
});
