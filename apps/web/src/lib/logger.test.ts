import assert from "node:assert/strict";
import test from "node:test";
import { logFrontendEvent, sanitizeFrontendLog } from "./logger.ts";

test("redacts credential-shaped fields recursively", () => {
  const payload = sanitizeFrontendLog({
    event: "web.test",
    context: {
      authorization: "Bearer secret-token",
      nested: {
        access_token: "token",
        safe: "ok",
      },
    },
  });

  assert.deepEqual(payload.context, {
    authorization: "[REDACTED]",
    nested: {
      access_token: "[REDACTED]",
      safe: "ok",
    },
  });
});

test("adds a timestamp without changing safe context", () => {
  const payload = sanitizeFrontendLog({
    event: "web.test",
    timestamp: "2026-09-21T04:00:00.000Z",
    context: { status: 200 },
  });

  assert.equal(payload.timestamp, "2026-09-21T04:00:00.000Z");
  assert.deepEqual(payload.context, { status: 200 });
});

test("emits structured payload through the injected sink", () => {
  let captured: { level: string; payload: unknown } | undefined;

  logFrontendEvent(
    {
      event: "web.api.health.failed",
      level: "error",
      context: { status: 503, password: "must-not-appear" },
    },
    (level, payload) => {
      captured = { level, payload };
    },
  );

  assert.equal(captured?.level, "error");
  assert.deepEqual(captured?.payload, {
    event: "web.api.health.failed",
    level: "error",
    timestamp: (captured?.payload as { timestamp: string }).timestamp,
    context: { status: 503, password: "[REDACTED]" },
  });
});
