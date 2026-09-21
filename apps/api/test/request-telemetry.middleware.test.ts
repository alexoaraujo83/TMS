import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { RequestTelemetryMiddleware } from "../src/common/request-telemetry.middleware.js";

function createResponse() {
  const response = new EventEmitter() as EventEmitter & {
    statusCode: number;
    once: EventEmitter["once"];
  };
  response.statusCode = 200;
  return response;
}

function createRequest(requestId?: string) {
  return {
    method: "GET",
    path: "/health",
    header: (name: string) =>
      name.toLowerCase() === "x-request-id" ? requestId : undefined,
  };
}

test("emits completion telemetry with request correlation and duration", () => {
  const events: unknown[] = [];
  let now = 1000;
  const middleware = new RequestTelemetryMiddleware({
    now: () => now,
    emit: (event) => events.push(event),
  });
  const req = createRequest("request-123");
  const res = createResponse();
  let nextCalls = 0;

  middleware.use(req as never, res as never, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  now = 1042;
  res.statusCode = 204;
  res.emit("finish");

  assert.deepEqual(events, [
    {
      event: "api.request.completed",
      requestId: "request-123",
      correlationId: "request-123",
      method: "GET",
      path: "/health",
      statusCode: 204,
      durationMs: 42,
    },
  ]);
});

test("uses request id as correlation fallback when correlation header is absent", () => {
  const events: Array<{ requestId: string }> = [];
  const middleware = new RequestTelemetryMiddleware({
    emit: (event) => events.push(event),
    now: () => 1000,
  });
  const req = createRequest();
  const res = createResponse();

  middleware.use(req as never, res as never, () => undefined);
  res.emit("finish");

  assert.match(events[0]?.requestId ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(events[0] && (events[0] as { correlationId: string }).correlationId, events[0]?.requestId);
});

test("does not let telemetry sink failures escape the response lifecycle", () => {
  const middleware = new RequestTelemetryMiddleware({
    emit: () => {
      throw new Error("TELEMETRY_SINK_FAILED");
    },
    now: () => 1000,
  });
  const req = createRequest("request-456");
  const res = createResponse();

  middleware.use(req as never, res as never, () => undefined);

  assert.doesNotThrow(() => res.emit("finish"));
});
