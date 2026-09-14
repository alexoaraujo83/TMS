import assert from "node:assert/strict";
import test from "node:test";
import { RequestContextMiddleware } from "../src/common/request-context.middleware.js";

function createResponse() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
}

function createRequest(requestId?: string) {
  const headers: Record<string, string> = {};
  if (requestId !== undefined) {
    headers["x-request-id"] = requestId;
  }

  return {
    headers,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

test("preserves a bounded incoming request id and returns it in the response", () => {
  const middleware = new RequestContextMiddleware();
  const req = createRequest("request-123");
  const res = createResponse();
  let nextCalls = 0;

  middleware.use(req as never, res as never, () => {
    nextCalls += 1;
  });

  assert.equal(req.headers["x-request-id"], "request-123");
  assert.equal(res.headers.get("X-Request-Id"), "request-123");
  assert.equal(nextCalls, 1);
});

test("generates a UUID when request id is missing", () => {
  const middleware = new RequestContextMiddleware();
  const req = createRequest();
  const res = createResponse();

  middleware.use(req as never, res as never, () => undefined);

  const requestId = req.headers["x-request-id"];
  assert.match(requestId ?? "", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(res.headers.get("X-Request-Id"), requestId);
});

test("regenerates a request id that exceeds the 128 character limit", () => {
  const middleware = new RequestContextMiddleware();
  const req = createRequest("x".repeat(129));
  const res = createResponse();

  middleware.use(req as never, res as never, () => undefined);

  assert.notEqual(req.headers["x-request-id"], "x".repeat(129));
  assert.equal(res.headers.get("X-Request-Id"), req.headers["x-request-id"]);
});

test("sets the security response headers", () => {
  const middleware = new RequestContextMiddleware();
  const req = createRequest("request-123");
  const res = createResponse();

  middleware.use(req as never, res as never, () => undefined);

  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.equal(
    res.headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    res.headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
});
