import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTenantIds, positiveIntegerEnv } from "./config.js";

test("parseTenantIds accepts UUIDs, trims values, and removes duplicates", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";

  assert.deepEqual(parseTenantIds(` ${first},${second},${first} `), [
    first,
    second,
  ]);
  assert.deepEqual(parseTenantIds(undefined), []);
});

test("parseTenantIds rejects malformed tenant configuration", () => {
  assert.throws(
    () => parseTenantIds("not-a-uuid"),
    /INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS:/,
  );
});

test("positiveIntegerEnv rejects zero, negative, and non-integer values", () => {
  const original = process.env.WORKER_TEST_VALUE;

  try {
    process.env.WORKER_TEST_VALUE = "0";
    assert.throws(
      () => positiveIntegerEnv("WORKER_TEST_VALUE", 5),
      /INVALID_WORKER_CONFIG:WORKER_TEST_VALUE/,
    );

    process.env.WORKER_TEST_VALUE = "-1";
    assert.throws(
      () => positiveIntegerEnv("WORKER_TEST_VALUE", 5),
      /INVALID_WORKER_CONFIG:WORKER_TEST_VALUE/,
    );

    process.env.WORKER_TEST_VALUE = "1.5";
    assert.throws(
      () => positiveIntegerEnv("WORKER_TEST_VALUE", 5),
      /INVALID_WORKER_CONFIG:WORKER_TEST_VALUE/,
    );
  } finally {
    if (original === undefined) delete process.env.WORKER_TEST_VALUE;
    else process.env.WORKER_TEST_VALUE = original;
  }
});
