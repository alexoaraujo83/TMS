import { describe, expect, it, vi } from "vitest";
import { WebhookPublisher } from "./webhook-publisher.js";

describe("WebhookPublisher", () => {
  const event = {
    id: "event-1",
    tenantId: "tenant-1",
    aggregateType: "freight",
    aggregateId: "freight-1",
    eventType: "freight.created",
    payload: { reference: "ABC-123" },
  };

  it("posts JSON without logging or altering the payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const publisher = new WebhookPublisher(["https://example.test/hook"], {
      fetchImpl,
    });

    await publisher.publish(event);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(request.body as string)).toEqual(event);
  });

  it("adds a deterministic HMAC signature when configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const publisher = new WebhookPublisher(["https://example.test/hook"], {
      secret: "test-secret",
      fetchImpl,
    });

    await publisher.publish(event);

    const [, request] = fetchImpl.mock.calls[0];
    expect(request.headers.get("x-tms-signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails the publication on a non-success HTTP response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const publisher = new WebhookPublisher(["https://example.test/hook"], {
      fetchImpl,
    });

    await expect(publisher.publish(event)).rejects.toThrow("WEBHOOK_HTTP_503");
  });

  it("rejects unsupported URL protocols", () => {
    expect(() => new WebhookPublisher(["ftp://example.test/hook"])).toThrow(
      "INVALID_WEBHOOK_URL",
    );
  });

  it("does not perform a request when no endpoints are configured", async () => {
    const fetchImpl = vi.fn();
    const publisher = new WebhookPublisher([], { fetchImpl });

    await publisher.publish(event);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
