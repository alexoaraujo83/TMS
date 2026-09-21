import assert from "node:assert/strict";
import test from "node:test";
import { createLogger, redact } from "./index.js";

test("redacts credentials recursively", () => {
  assert.deepEqual(redact({ Authorization: "Bearer secret", nested: { password: "pw", access_token: "token" }, safe: "ok" }), {
    Authorization: "[REDACTED]",
    nested: { password: "[REDACTED]", access_token: "[REDACTED]" },
    safe: "ok",
  });
});

test("emits structured JSON with correlation fields", () => {
  const lines: string[] = [];
  const logger = createLogger({ service: "tms-api", environment: "test", emit: (line) => lines.push(line) });
  logger.log("INFO", "http.request.completed", { requestId: "req-1", correlationId: "corr-1", tenantId: "tenant-1", userId: "user-1" }, { status_code: 200, Authorization: "Bearer secret" });
  const record = JSON.parse(lines[0] ?? "{}");
  assert.equal(record.request_id, "req-1");
  assert.equal(record.correlation_id, "corr-1");
  assert.equal(record.tenant_id, "tenant-1");
  assert.equal(record.Authorization, "[REDACTED]");
});
