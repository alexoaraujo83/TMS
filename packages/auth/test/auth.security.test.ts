import { strict as assert } from "node:assert";
import test from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  NEXORA_TENANT_ID_CLAIM,
  verifyAccessToken,
} from "../src/index.ts";

const issuer = "https://tenant.example.auth0.com";
const audience = "urn:nexora:tms:api:development";
const jwksUrl = "https://jwks.example.test/.well-known/jwks.json";

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        keys: [
          {
            ...jwk,
            kty: "RSA",
            use: "sig",
            alg: "RS256",
            kid: "test-key",
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );

  return { privateKey, originalFetch };
}

async function token(
  privateKey: CryptoKey,
  overrides: Record<string, unknown> = {},
) {
  return new SignJWT({
    [NEXORA_TENANT_ID_CLAIM]: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
    .setSubject("auth0|user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

test("accepts a valid RS256 access token", async () => {
  const { privateKey, originalFetch } = await setup();
  try {
    const result = await verifyAccessToken(await token(privateKey), {
      issuer,
      audience,
      jwksUrl,
    });
    assert.equal(result.sub, "auth0|user-1");
    assert.equal(result.tenantId, "11111111-1111-1111-1111-111111111111");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a token signed with an unexpected algorithm", async () => {
  const bad = await new SignJWT({
    [NEXORA_TENANT_ID_CLAIM]: "11111111-1111-1111-1111-111111111111",
  })
    .setProtectedHeader({ alg: "HS384", typ: "JWT" })
    .setSubject("auth0|user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode("test-only-secret"));

  await assert.rejects(() =>
    verifyAccessToken(bad, { issuer, audience, jwksUrl }),
  );
});
