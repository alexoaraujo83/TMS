import { jwtVerify } from "jose";
import type { TenantContext } from "@tms/tenancy";

export interface AuthClaims {
  sub: string;
  tenantId?: string;
  issuer: string;
  audience: string;
}

export interface AuthenticatedRequestContext extends TenantContext {
  permissions: readonly string[];
}

export interface JwtVerifierConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export async function verifyAccessToken(
  token: string,
  config: JwtVerifierConfig,
): Promise<AuthClaims> {
  if (!token || token.length > 8192) throw new Error("Invalid access token");

  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(config.secret),
    {
      algorithms: ["HS256"],
      issuer: config.issuer,
      audience: config.audience,
    },
  );

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Invalid authentication claims");
  }

  return {
    sub: payload.sub,
    tenantId:
      typeof payload.tenantId === "string" ? payload.tenantId : undefined,
    issuer: config.issuer,
    audience: config.audience,
  };
}
