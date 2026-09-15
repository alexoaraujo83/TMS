import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDatabaseUrl } from "./database-url.js";

test("normalizeDatabaseUrl enforces verify-full without changing other parameters", () => {
  const input =
    "postgresql://tms_app:secret@example.test:5432/tms?sslmode=require&channel_binding=require";
  const normalized = new URL(normalizeDatabaseUrl(input));

  assert.equal(normalized.searchParams.get("sslmode"), "verify-full");
  assert.equal(normalized.searchParams.get("channel_binding"), "require");
  assert.equal(normalized.username, "tms_app");
  assert.equal(normalized.password, "secret");
});

test("normalizeDatabaseUrl replaces weaker SSL aliases deterministically", () => {
  for (const sslmode of ["prefer", "require", "verify-ca"]) {
    const normalized = new URL(
      normalizeDatabaseUrl(
        `postgresql://tms_app:secret@example.test:5432/tms?sslmode=${sslmode}`,
      ),
    );

    assert.equal(normalized.searchParams.get("sslmode"), "verify-full");
  }
});
