import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt, jwtVerify, createRemoteJWKSet } from "jose";

const SESSION_COOKIE = "tms_session";
const STATE_COOKIE = "tms_auth_state";
const NONCE_COOKIE = "tms_auth_nonce";
const VERIFIER_COOKIE = "tms_pkce_verifier";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

interface SessionPayload {
  accessToken: string;
  expiresAt: number;
  user?: Record<string, unknown>;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function issuer(): string {
  return required("AUTH0_ISSUER_BASE_URL").replace(/\\/$/, "");
}

function baseUrl(): string {
  return required("AUTH0_BASE_URL").replace(/\\/$/, "");
}

function sessionKey(): Buffer {
  return createHash("sha256").update(required("AUTH0_SECRET")).digest();
}

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

function randomToken(): string {
  return base64Url(randomBytes(32));
}

async function pkceChallenge(verifier: string): Promise<string> {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function buildLoginUrl(): Promise<string> {
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const challenge = await pkceChallenge(verifier);
  const store = await cookies();

  store.set(STATE_COOKIE, state, secureCookieOptions(600));
  store.set(NONCE_COOKIE, nonce, secureCookieOptions(600));
  store.set(VERIFIER_COOKIE, verifier, secureCookieOptions(600));

  const url = new URL(`${issuer()}/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", required("AUTH0_CLIENT_ID"));
  url.searchParams.set("redirect_uri", `${baseUrl()}/api/auth/callback`);
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("audience", required("AUTH0_AUDIENCE"));
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export async function exchangeCode(code: string, state: string) {
  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  const verifier = store.get(VERIFIER_COOKIE)?.value;
  const expectedNonce = store.get(NONCE_COOKIE)?.value;

  if (!expectedState || expectedState !== state || !verifier || !expectedNonce) {
    throw new Error("Invalid authentication transaction");
  }

  const response = await fetch(`${issuer()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: required("AUTH0_CLIENT_ID"),
      client_secret: required("AUTH0_CLIENT_SECRET"),
      code,
      redirect_uri: `${baseUrl()}/api/auth/callback`,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) throw new Error("Auth0 token exchange failed");

  const tokens = (await response.json()) as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!tokens.access_token || !tokens.id_token) {
    throw new Error("Auth0 token response is incomplete");
  }

  const jwks = createRemoteJWKSet(new URL(`${issuer()}/.well-known/jwks.json`));
  const verified = await jwtVerify(tokens.id_token, jwks, {
    issuer: issuer(),
    audience: required("AUTH0_CLIENT_ID"),
  });

  if (verified.payload.nonce !== expectedNonce) {
    throw new Error("Invalid authentication nonce");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, tokens.expires_in ?? 3600);
  const session = await new EncryptJWT({
    accessToken: tokens.access_token,
    expiresAt,
    user: {
      sub: verified.payload.sub,
      name: verified.payload.name,
      email: verified.payload.email,
      picture: verified.payload.picture,
    },
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
    .encrypt(sessionKey());

  store.set(SESSION_COOKIE, session, secureCookieOptions(SESSION_TTL_SECONDS));
  store.delete(STATE_COOKIE);
  store.delete(NONCE_COOKIE);
  store.delete(VERIFIER_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    const { payload } = await jwtDecrypt(value, sessionKey(), {
      clockTolerance: 5,
    });
    if (typeof payload.accessToken !== "string" || typeof payload.expiresAt !== "number") {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session || session.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return session.accessToken;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function logoutUrl(): string {
  const url = new URL(`${issuer()}/v2/logout`);
  url.searchParams.set("client_id", required("AUTH0_CLIENT_ID"));
  url.searchParams.set("returnTo", baseUrl());
  return url.toString();
}
