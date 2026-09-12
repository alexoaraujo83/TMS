import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { RequestContext } from "./request-context.js";

interface RequestLike {
  context?: RequestContext;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (!request.context?.userId || !request.context.tenantId) {
      throw new UnauthorizedException("Authenticated user context required");
    }
    return request.context;
  },
);
