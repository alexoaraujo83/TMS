import { strict as assert } from "node:assert";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { KeyLike } from "jose";
import {
  LEGACY_NEXORA_TENANT_ID_CLAIM,
  TMS_TENANT_ID_CLAIM,
  verifyAccessToken,
} from "../src/index.ts";

const ISSUER = "https://tenant.example.auth0.com";
const AUDIENCE = "urn:tms:api:development";
const JWKS_URL = "https://jwks.example.test/.well-known/jwks.json";

type SigningKey = KeyLike | Uint8Array;

async function signedToken(
  privateKey: SigningKey,
  options: {
    issuer?: string;
    audience?: string;
    tenantId?: string;
    legacyTenantId?: string;
    rootTenantId?: string;
    algorithm?: "RS256" | "HS256";
    kid?: string;
    expiresAt?: number;
  } = {},
) {
  const payload: Record<string, unknown> = {};
  if (options.tenantId !== undefined) {
    payload[TMS_TENANT_ID_CLAIM] = options.tenantId;
  }
  if (options.legacyTenantId !== undefined) {
    payload[LEGACY_NEXORA_TENANT_ID_CLAIM] = options.legacyTenantId;
  }
  if (options.rootTenantId !== undefined) {
    payload.tenantId = options.rootTenantId;
  }

  let builder = new SignJWT(payload).setProtectedHeader({
    alg: options.algorithm ?? "RS256",
    kid: options.kid ?? "test-key",
  });
  builder = builder
    .setSubject("auth0|user-1")
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? "5m");

  return builder.sign(privateKey);
}

async function withJwks(
  publicKey: Awaited<ReturnType<typeof generateKeyPair>>["publicKey"],
  action: () => Promise<void>,
) {
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
    await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("verifyAccessToken accepts canonical Auth0 issuers with or without trailing slash", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, { issuer: `${ISSUER}/` });
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.sub, "auth0|user-1");
    assert.equal(claims.issuer, `${ISSUER}/`);
  });
});

test("verifyAccessToken accepts the canonical TMS namespaced tenant claim", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, { tenantId: "tenant-a" });
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.tenantId, "tenant-a");
  });
});

test("verifyAccessToken accepts the legacy Nexora tenant claim during migration", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      legacyTenantId: "tenant-legacy",
    });
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.tenantId, "tenant-legacy");
  });
});

test("verifyAccessToken prefers the canonical TMS tenant claim over the legacy claim", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      tenantId: "tenant-tms",
      legacyTenantId: "tenant-legacy",
    });
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.tenantId, "tenant-tms");
  });
});

test("verifyAccessToken ignores a root tenantId claim", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      rootTenantId: "ignored-root-claim",
    });
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.tenantId, undefined);
  });
});

test("verifyAccessToken leaves tenant selection undefined when the token has no tenant claim", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey);
    const claims = await verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    });

    assert.equal(claims.tenantId, undefined);
  });
});

test("verifyAccessToken rejects an invalid audience", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      audience: "wrong-audience",
    });
    await assert.rejects(
      verifyAccessToken(token, {
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUrl: JWKS_URL,
      }),
    );
  });
});

test("verifyAccessToken rejects an invalid issuer", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      issuer: "https://attacker.example.com",
    });
    await assert.rejects(
      verifyAccessToken(token, {
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUrl: JWKS_URL,
      }),
    );
  });
});

test("verifyAccessToken rejects expired tokens", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");

  await withJwks(publicKey, async () => {
    const token = await signedToken(privateKey, {
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });
    await assert.rejects(
      verifyAccessToken(token, {
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUrl: JWKS_URL,
      }),
    );
  });
});

test("verifyAccessToken rejects an unknown signing key", async () => {
  const { privateKey } = await generateKeyPair("RS256");
  const { publicKey: otherPublicKey } = await generateKeyPair("RS256");

  const jwk = await exportJWK(otherPublicKey);
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
            kid: "other-key",
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );

  try {
    const token = await signedToken(privateKey);
    await assert.rejects(
      verifyAccessToken(token, {
        issuer: ISSUER,
        audience: AUDIENCE,
        jwksUrl: JWKS_URL,
      }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("verifyAccessToken rejects HS256 tokens", async () => {
  const token = await signedToken(
    new TextEncoder().encode("test-only-secret"),
    {
      algorithm: "HS256",
    },
  );

  await assert.rejects(
    verifyAccessToken(token, {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUrl: JWKS_URL,
    }),
  );
});
