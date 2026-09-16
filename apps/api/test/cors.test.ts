import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCorsOrigin, parseCorsOrigins } from "../src/common/cors.js";

test("parses an explicit comma-separated CORS allowlist", () => {
  assert.deepEqual(
    parseCorsOrigins("https://app.example.com, https://admin.example.com,,"),
    ["https://app.example.com", "https://admin.example.com"],
  );
});

test("allows only origins present in the configured allowlist", () => {
  const origins = parseCorsOrigins("https://app.example.com");

  assert.equal(isAllowedCorsOrigin("https://app.example.com", origins), true);
  assert.equal(isAllowedCorsOrigin("https://evil.example.com", origins), false);
  assert.equal(isAllowedCorsOrigin(undefined, origins), false);
});

test("does not treat an empty allowlist as permissive", () => {
  assert.deepEqual(parseCorsOrigins(undefined), []);
  assert.equal(isAllowedCorsOrigin("https://app.example.com", []), false);
});
