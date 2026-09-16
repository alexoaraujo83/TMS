import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHttpExceptionMessage } from "../src/common/http-exception.filter.js";

test("keeps a string HTTP error message unchanged", () => {
  assert.equal(
    normalizeHttpExceptionMessage("Authentication required"),
    "Authentication required",
  );
});

test("normalizes Nest validation message arrays to a stable string", () => {
  assert.equal(
    normalizeHttpExceptionMessage({
      message: ["originCity must be a string", "weightKg must be positive"],
    }),
    "originCity must be a string; weightKg must be positive",
  );
});

test("uses the stable fallback for missing messages", () => {
  assert.equal(
    normalizeHttpExceptionMessage({ error: "Bad Request" }),
    "Request failed",
  );
  assert.equal(normalizeHttpExceptionMessage(undefined), "Request failed");
});
