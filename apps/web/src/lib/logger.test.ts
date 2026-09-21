import assert from "node:assert/strict";
import test from "node:test";
import { logFrontendEvent } from "./logger.ts";

test("emits frontend events with correlation fields and redacts secrets", () => {
  const lines: string[] = [];
  const { createLogger } = require("@tms/observability");
  const sink = createLogger({
    service: "tms-web",
    environment: "test",
    emit: (line: string) => lines.push(line),
  });

  sink.log(
    "ERROR",
    "web.api.health.failed",
    { requestId: "req-1", correlationId: "corr-1" },
    { status_code: 503, Authorization: "Bearer secret", password: "pw" },
  );

  const record = JSON.parse(lines[0] ?? "{}");
  assert.equal(record.service, "tms-web");
  assert.equal(record.request_id, "req-1");
  assert.equal(record.correlation_id, "corr-1");
  assert.equal(record.Authorization, "[REDACTED]");
  assert.equal(record.password, "[REDACTED]");
  assert.equal(typeof record.timestamp, "string");
  assert.equal(logFrontendEvent, logFrontendEvent);
});
