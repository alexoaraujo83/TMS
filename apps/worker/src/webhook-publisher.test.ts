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

test("posts JSON without altering the event payload", async () => {
  const calls: Array<[string, RequestInit | undefined]> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push([String(url), init]);
    return new Response(null, { status: 204 });
  };
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    fetchImpl,
  });

  await publisher.publish(event);

  assert.equal(calls.length, 1);
  const request = calls[0]?.[1];
  assert.equal(request?.method, "POST");
  assert.equal(
    new Headers(request?.headers).get("content-type"),
    "application/json",
  );
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

test("fails publication on a non-success HTTP response", async () => {
  const fetchImpl = async () => new Response(null, { status: 503 });
  const publisher = new WebhookPublisher(["https://example.test/hook"], {
    fetchImpl,
  });

  await assert.rejects(publisher.publish(event), /WEBHOOK_HTTP_503/);
});

test("rejects unsupported URL protocols", () => {
  assert.throws(
    () => new WebhookPublisher(["ftp://example.test/hook"]),
    /INVALID_WEBHOOK_URL/,
  );
});

test("rejects a non-positive timeout", () => {
  assert.throws(
    () =>
      new WebhookPublisher(["https://example.test/hook"], {
        timeoutMs: 0,
      }),
    /INVALID_WEBHOOK_TIMEOUT/,
  );
});

test("does not perform a request when no endpoints are configured", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  };
  const publisher = new WebhookPublisher([], { fetchImpl });

  await publisher.publish(event);

  assert.equal(calls, 0);
});
