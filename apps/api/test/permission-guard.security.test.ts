import assert from 'node:assert/strict';
import test from 'node:test';
import { PermissionGuard } from '../src/common/permission.guard.ts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function contextFor(permissions: readonly string[]) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        context: {
          requestId: 'req-1',
          userId: USER_ID,
          tenantId: TENANT_ID,
          roles: ['operator'],
          permissions,
        },
      }),
    }),
  } as never;
}

function guard(permission: string | undefined) {
  return new PermissionGuard({
    getAllAndOverride: () => permission,
  } as never);
}

test('PermissionGuard denies a missing database permission', () => {
  assert.throws(
    () => guard('freight:create').canActivate(contextFor(['freight:read'])),
    (error: unknown) => error instanceof Error && error.message === 'Insufficient permission',
  );
});

test('PermissionGuard accepts the exact database permission', () => {
  assert.equal(guard('freight:create').canActivate(contextFor(['freight:create'])), true);
});

test('PermissionGuard allows an explicit wildcard permission', () => {
  assert.equal(guard('iam:manage').canActivate(contextFor(['*'])), true);
});

test('PermissionGuard rejects requests without authenticated context', () => {
  const executionContext = {
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as never;

  assert.throws(
    () => guard('freight:read').canActivate(executionContext),
    (error: unknown) => error instanceof Error && error.message === 'Insufficient permission',
  );
});

test('PermissionGuard fails closed when no permission metadata is declared', () => {
  assert.throws(
    () => guard(undefined).canActivate(contextFor([])),
    (error: unknown) => error instanceof Error && error.message === 'Permission requirement is not configured',
  );
});
