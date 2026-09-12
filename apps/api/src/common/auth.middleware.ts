import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@tms/auth";
import { verifyTenantMembership } from "@tms/database";
import type { Pool } from "pg";
import { DATABASE_POOL } from "./database.provider.js";
import { Inject } from "@nestjs/common";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authorization = req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication required");
    }

    const token = authorization.slice("Bearer ".length).trim();
    const secret = process.env.JWT_SECRET;
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    if (!secret || !issuer || !audience) {
      throw new Error("JWT authentication configuration is required");
    }

    try {
      const claims = await verifyAccessToken(token, { secret, issuer, audience });
      if (!claims.tenantId) {
        throw new UnauthorizedException("Tenant context is required");
      }

      const membership = await verifyTenantMembership(
        this.pool,
        claims.sub,
        claims.tenantId,
      );
      if (!membership?.active) {
        throw new UnauthorizedException("Active tenant membership required");
      }

      req.tmsContext = {
        userId: claims.sub,
        tenantId: claims.tenantId,
        roles: [membership.role],
        permissions: membership.permissions,
      };
      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid authentication credentials");
    }
  }
}
