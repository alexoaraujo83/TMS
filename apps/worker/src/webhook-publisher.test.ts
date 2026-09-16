import assert from "node:assert/strict";
import test from "node:test";
import { WebhookPublisher } from "./webhook-publisher.js";

const event = {
  id: "event-1",
  tenantId: "tenant-1",
  aggregateType: "freight",
  aggregateId: "freight-1",
  eventType: "freight.created",
  payload: { reference: "ABC-123" },
};

test("posts JSON with idempotency, signature, and no redirect", async () => {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init]);
    return new Response(null, { status: 204 });
  };
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    secret: "test-secret",
    fetchImpl,
  });

  await publisher.publish(event);

  assert.equal(calls.length, 1);
  const request = calls[0]?.[1];
  assert.equal(request?.method, "POST");
  assert.equal(request?.redirect, "error");
  const headers = new Headers(request?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("idempotency-key"), event.id);
  assert.match(headers.get("x-tms-signature") ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(request?.body as string), event);
});

test("adds a deterministic HMAC signature when configured", async () => {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init]);
    return new Response(null, { status: 200 });
  };
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    secret: "test-secret",
    fetchImpl,
  });

  await publisher.publish(event);

  const request = calls[0]?.[1];
  assert.match(
    new Headers(request?.headers).get("x-tms-signature") ?? "",
    /^[a-f0-9]{64}$/,
  );
});

test("rejects HTTP webhook URLs", () => {
  assert.throws(
    () =>
      new WebhookPublisher(["http://example.test/hook"], {
        secret: "test-secret",
      }),
    /INVALID_WEBHOOK_URL/,
  );
});

test("requires a non-empty HMAC secret when endpoints are configured", () => {
  assert.throws(
    () => new WebhookPublisher(["https://example.test/hook"]),
    /WEBHOOK_SECRET_REQUIRED/,
  );
  assert.throws(
    () =>
      new WebhookPublisher(["https://example.test/hook"], {
        secret: "   ",
      }),
    /WEBHOOK_SECRET_REQUIRED/,
  );
});

test("fails publication on a non-success HTTP response", async () => {
  const fetchImpl = async () => new Response(null, { status: 503 });
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    secret: "test-secret",
    fetchImpl,
  });

  await assert.rejects(publisher.publish(event), /WEBHOOK_HTTP_503/);
});

test("normalizes request timeout failures", async () => {
  const fetchImpl = async () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    throw error;
  };
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    timeoutMs: 100,
    secret: "test-secret",
    fetchImpl,
  });

  await assert.rejects(publisher.publish(event), /WEBHOOK_TIMEOUT/);
});

test("rejects malformed webhook URLs", () => {
  assert.throws(
    () => new WebhookPublisher(["not-a-url"]),
    /INVALID_WEBHOOK_URL/,
  );
});

test("rejects unsupported URL protocols", () => {
  assert.throws(
    () =>
      new WebhookPublisher(["ftp://example.test/hook"], {
        secret: "test-secret",
      }),
    /INVALID_WEBHOOK_URL/,
  );
});

test("rejects a non-positive timeout", () => {
  assert.throws(
    () =>
      new WebhookPublisher(["https://example.test/hook"], {
        timeoutMs: 0,
        secret: "test-secret",
      }),
    /INVALID_WEBHOOK_TIMEOUT/,
  );
});

test("fails closed when no endpoints are configured", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  };
  const publisher = new WebhookPublisher([], { fetchImpl });

  await assert.rejects(publisher.publish(event), /WEBHOOK_ENDPOINTS_REQUIRED/);
  assert.equal(calls, 0);
});
