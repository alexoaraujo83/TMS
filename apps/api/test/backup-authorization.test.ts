import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { BackupController } from "../src/modules/backup/backup.controller.ts";
import { PermissionGuard, REQUIRED_PERMISSION } from "../src/common/permission.guard.ts";

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => BackupController.prototype.listManifests,
    getClass: () => BackupController,
  } as never;
}

function guard() {
  const reflector = new Reflector();
  return new PermissionGuard(reflector);
}

test("backup manifests require iam:manage and deny an authenticated user without it", () => {
  const request = {
    context: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      roles: ["operator"],
      permissions: ["freight:read"],
    },
  };

  assert.throws(
    () => guard().canActivate(contextFor(request)),
    (error: unknown) =>
      error instanceof Error && error.message === "Insufficient permission",
  );
});

test("backup manifests controller requires iam:manage", () => {
  const handler = BackupController.prototype.listManifests;
  assert.equal(
    Reflect.getMetadata(REQUIRED_PERMISSION, handler),
    "iam:manage",
  );
});
