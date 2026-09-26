import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_PERMISSION } from "../src/common/permission.guard.ts";
import { FreightController } from "../src/modules/freight/freight.controller.ts";

const expected: Record<string, string> = {
  create: "freight:create",
  list: "freight:read",
  runtimeContext: "ops:diagnostics",
  runtimeDbContext: "ops:diagnostics",
  runtimeRlsIsolation: "ops:diagnostics",
  runtimeAuthClaims: "ops:diagnostics",
  update: "freight:update",
  remove: "freight:delete",
  get: "freight:read",
  matches: "matching:read",
  assign: "matching:assign",
  replayStatusChangedEvent: "freight:replay",
  updateStatus: "freight:update",
};

test("FreightController declares an explicit permission for every protected route", () => {
  const prototype = FreightController.prototype as Record<string, unknown>;

  for (const [method, permission] of Object.entries(expected)) {
    const handler = prototype[method];
    assert.equal(typeof handler, "function", `missing controller method: ${method}`);
    assert.equal(
      Reflect.getMetadata(REQUIRED_PERMISSION, handler),
      permission,
      `unexpected permission metadata for ${method}`,
    );
  }
});

test("diagnostic routes never reuse freight:read authorization", () => {
  const prototype = FreightController.prototype as Record<string, unknown>;
  for (const method of [
    "runtimeContext",
    "runtimeDbContext",
    "runtimeRlsIsolation",
    "runtimeAuthClaims",
  ]) {
    assert.notEqual(
      Reflect.getMetadata(REQUIRED_PERMISSION, prototype[method]),
      "freight:read",
    );
  }
});

test("replay route uses the dedicated freight:replay permission", () => {
  const prototype = FreightController.prototype as Record<string, unknown>;
  assert.equal(
    Reflect.getMetadata(
      REQUIRED_PERMISSION,
      prototype.replayStatusChangedEvent,
    ),
    "freight:replay",
  );
});
