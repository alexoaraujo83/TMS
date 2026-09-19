import { createRemoteJWKSet, jwtVerify } from "jose";
import type { TenantContext } from "@tms/tenancy";

export const TMS_AUTH_CLAIMS_NAMESPACE = "https://tms-platform.io/claims";
export const TMS_TENANT_ID_CLAIM = `${TMS_AUTH_CLAIMS_NAMESPACE}/tenant_id`;

export interface AuthClaims {
  sub: string;
  tenantId?: string;
  issuer: string;
  audience: string | string[];
}

export interface AuthenticatedRequestContext extends TenantContext {
  permissions: readonly string[];
}

export interface OidcVerifierConfig {
  issuer: string;
  audience: string;
  jwksUrl?: string;
}

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

function extractTenantId(payload: Record<string, unknown>): string | undefined {
  return typeof payload[TMS_TENANT_ID_CLAIM] === "string"
    ? payload[TMS_TENANT_ID_CLAIM]
    : undefined;
}

export async function verifyAccessToken(
  token: string,
  config: OidcVerifierConfig,
): Promise<AuthClaims> {
  if (!token || token.length > 8192) throw new Error("Invalid access token");

  const issuer = normalizeIssuer(config.issuer);
  if (!issuer || !config.audience) {
    throw new Error("OIDC verification is not configured");
  }

  const jwks = createRemoteJWKSet(
    new URL(config.jwksUrl ?? `${issuer}/.well-known/jwks.json`),
  );

  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["RS256"],
    issuer: [issuer, `${issuer}/`],
    audience: config.audience,
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Invalid authentication claims");
  }

  return {
    sub: payload.sub,
    tenantId: extractTenantId(payload),
    issuer: typeof payload.iss === "string" ? payload.iss : issuer,
    audience: payload.aud ?? config.audience,
  };
}
