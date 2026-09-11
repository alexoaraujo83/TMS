import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyAccessToken } from '@tms/auth';
import type { RequestContext } from './request-context.js';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  context?: RequestContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<RequestLike>();
    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const secret = process.env.JWT_SECRET;
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;

    if (!secret || secret === 'replace-with-a-local-only-secret' || !issuer || !audience) {
      throw new UnauthorizedException('JWT verification is not configured');
    }

    try {
      const claims = await verifyAccessToken(token, { secret, issuer, audience });
      request.context = {
        requestId: typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : '',
        userId: claims.sub,
        tenantId: claims.tenantId,
        roles: claims.roles,
        permissions: claims.permissions,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
