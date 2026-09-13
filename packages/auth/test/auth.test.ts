import { strict as assert } from "node:assert";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { verifyAccessToken } from "../src/index.ts";

test("verifyAccessToken accepts a valid RS256 token", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const issuer = "https://tenant.example.auth0.com/";
  const audience = "urn:nexora:tms:api:development";
  const token = await new SignJWT({ tenantId: "tenant-a" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setSubject("auth0|user-1")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
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

  try {
    const claims = await verifyAccessToken(token, {
      issuer,
      audience,
      jwksUrl: "https://jwks.example.test/.well-known/jwks.json",
    });
    assert.equal(claims.sub, "auth0|user-1");
    assert.equal(claims.tenantId, "tenant-a");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("verifyAccessToken rejects HS256 tokens", async () => {
  const token = await new SignJWT({ tenantId: "tenant-a" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("auth0|user-1")
    .setIssuer("https://tenant.example.auth0.com/")
    .setAudience("urn:nexora:tms:api:development")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode("test-only-secret"));

  await assert.rejects(
    verifyAccessToken(token, {
      issuer: "https://tenant.example.auth0.com/",
      audience: "urn:nexora:tms:api:development",
      jwksUrl: "https://jwks.example.test/.well-known/jwks.json",
    }),
  );
});

test("verifyAccessToken rejects a wrong audience", async () => {
  const { privateKey } = await generateKeyPair("RS256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "missing-key" })
    .setSubject("auth0|user-1")
    .setIssuer("https://tenant.example.auth0.com/")
    .setAudience("wrong-audience")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);

  await assert.rejects(
    verifyAccessToken(token, {
      issuer: "https://tenant.example.auth0.com/",
      audience: "urn:nexora:tms:api:development",
      jwksUrl: "https://jwks.example.test/.well-known/jwks.json",
    }),
  );
});
