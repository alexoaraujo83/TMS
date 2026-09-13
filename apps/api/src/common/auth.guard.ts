import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { verifyAccessToken } from "@tms/auth";
import { verifyTenantMembership } from "@tms/database";
import type { Pool } from "pg";
import type { RequestContext } from "./request-context.js";
import { DATABASE_POOL } from "./database.provider.js";

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  context?: RequestContext;
}

function headerValue(request: RequestLike, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext.switchToHttp().getRequest<RequestLike>();
    const authorization = headerValue(request, "authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }

    const token = authorization.slice("Bearer ".length).trim();
    const issuer = process.env.AUTH0_ISSUER_BASE_URL;
    const audience = process.env.AUTH0_AUDIENCE;
    const jwksUrl = process.env.AUTH0_JWKS_URL;

    if (!issuer || !audience) {
      throw new UnauthorizedException("OIDC verification is not configured");
    }

    try {
      const claims = await verifyAccessToken(token, {
        issuer,
        audience,
        jwksUrl,
      });
      const selectedTenantId =
        headerValue(request, "x-tenant-id") ?? claims.tenantId;

      if (!selectedTenantId) {
        throw new UnauthorizedException("Tenant selection is required");
      }

      const membership = await verifyTenantMembership(
        this.pool,
        claims.sub,
        selectedTenantId,
      );
      if (!membership?.active) {
        throw new ForbiddenException("Active tenant membership required");
      }

      request.context = {
        requestId: headerValue(request, "x-request-id") ?? "",
        userId: membership.userId,
        tenantId: membership.tenantId,
        roles: [membership.role],
        permissions: membership.permissions,
      };
      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new UnauthorizedException("Invalid access token");
    }
  }
}
