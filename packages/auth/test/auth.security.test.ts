import { strict as assert } from 'node:assert';
import test from 'node:test';
import { SignJWT } from 'jose';
import { verifyAccessToken } from '../src/index.ts';

const secret = 'test-only-secret-that-is-long-enough';
const config = { secret, issuer: 'tms-test', audience: 'tms-api-test' };

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    tenantId: '11111111-1111-1111-1111-111111111111',
    roles: ['operator'],
    permissions: ['freight:read'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('22222222-2222-2222-2222-222222222222')
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
}

test('accepts a valid HS256 access token', async () => {
  const result = await verifyAccessToken(await token(), config);
  assert.equal(result.sub, '22222222-2222-2222-2222-222222222222');
  assert.equal(result.tenantId, '11111111-1111-1111-1111-111111111111');
});

test('rejects a token signed with an unexpected algorithm', async () => {
  const bad = await new SignJWT({ tenantId: '11111111-1111-1111-1111-111111111111' })
    .setProtectedHeader({ alg: 'HS384', typ: 'JWT' })
    .setSubject('22222222-2222-2222-2222-222222222222')
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));

  await assert.rejects(() => verifyAccessToken(bad, config));
});

test('rejects a token with an invalid issuer', async () => {
  const bad = await new SignJWT({ tenantId: '11111111-1111-1111-1111-111111111111' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('22222222-2222-2222-2222-222222222222')
    .setIssuer('attacker')
    .setAudience(config.audience)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));

  await assert.rejects(() => verifyAccessToken(bad, config));
});

test('rejects a token without a subject or tenant claim', async () => {
  const bad = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));

  await assert.rejects(() => verifyAccessToken(bad, config));
});

test('rejects oversized bearer material before JWT verification', async () => {
  await assert.rejects(() => verifyAccessToken('x'.repeat(8193), config));
});
