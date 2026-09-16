import { createHmac } from "node:crypto";

export interface WebhookPublisherOptions {
  timeoutMs?: number;
  secret?: string;
  fetchImpl?: typeof fetch;
}

export class WebhookPublisher {
  private readonly timeoutMs: number;
  private readonly secret: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly urls: string[],
    options: WebhookPublisherOptions = {},
  ) {
    this.urls.forEach((url) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error("INVALID_WEBHOOK_URL");
      }
      if (parsed.protocol !== "https:") {
        throw new Error("INVALID_WEBHOOK_URL");
      }
    });

    this.timeoutMs = options.timeoutMs ?? 10000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new Error("INVALID_WEBHOOK_TIMEOUT");
    }

    if (this.urls.length > 0 && !options.secret?.trim()) {
      throw new Error("WEBHOOK_SECRET_REQUIRED");
    }

    this.secret = options.secret ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async publish(event: {
    id: string;
    tenantId: string;
    aggregateType: string;
    aggregateId: string | null;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (this.urls.length === 0) {
      throw new Error("WEBHOOK_ENDPOINTS_REQUIRED");
    }

    const body = JSON.stringify({
      id: event.id,
      tenantId: event.tenantId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
    });
    const signature = createHmac("sha256", this.secret).update(body).digest("hex");

    for (const url of this.urls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "idempotency-key": event.id,
            "x-tms-signature": signature,
          },
          body,
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`WEBHOOK_HTTP_${response.status}`);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("WEBHOOK_TIMEOUT");
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  }
}
