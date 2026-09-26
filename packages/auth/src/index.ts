import { createRemoteJWKSet, jwtVerify } from "jose";
import type { TenantContext } from "@tms/tenancy";

export const TMS_AUTH_CLAIMS_NAMESPACE = "https://tms-platform.io/claims";
export const TMS_TENANT_ID_CLAIM = `${TMS_AUTH_CLAIMS_NAMESPACE}/tenant_id`;
export const TMS_EMAIL_CLAIM = `${TMS_AUTH_CLAIMS_NAMESPACE}/email`;
export const TMS_DISPLAY_NAME_CLAIM = `${TMS_AUTH_CLAIMS_NAMESPACE}/display_name`;

export interface AuthClaims {
  sub: string;
  tenantId?: string;
  email?: string;
  name?: string;
  issuer: string;
  audience: string | string[];
  expiresAt?: number;
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

function extractStringClaim(
  payload: Record<string, unknown>,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    if (typeof payload[name] === "string" && payload[name].trim().length > 0) {
      return payload[name].trim();
    }
  }
  return undefined;
}

function extractTenantId(payload: Record<string, unknown>): string | undefined {
  return extractStringClaim(payload, [TMS_TENANT_ID_CLAIM]);
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
    email: extractStringClaim(payload, ["email", TMS_EMAIL_CLAIM]),
    name: extractStringClaim(payload, ["name", TMS_DISPLAY_NAME_CLAIM]),
    issuer: typeof payload.iss === "string" ? payload.iss : issuer,
    audience: payload.aud ?? config.audience,
    expiresAt: payload.exp,
  };
}
