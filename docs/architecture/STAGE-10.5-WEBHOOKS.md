# Stage 10.5 — Webhook Delivery Foundation

## Purpose

Provide a production-safe HTTP delivery adapter for the existing tenant-scoped outbox without changing outbox persistence semantics.

## Configuration

- `OUTBOX_WEBHOOK_URLS`: comma-separated HTTP(S) endpoints.
- `OUTBOX_WEBHOOK_SECRET`: optional HMAC-SHA256 signing secret.
- `OUTBOX_WEBHOOK_TIMEOUT_MS`: positive request timeout; default `10000`.

Endpoint URLs and secrets are configuration only and must not be written to logs.

## Delivery contract

The worker POSTs JSON containing the outbox event identity, tenant, aggregate metadata, event type and payload. A non-2xx response is treated as a delivery failure so the existing outbox retry policy can reschedule the event.

When a secret is configured, the raw request body is signed with HMAC-SHA256 and sent in `x-tms-signature` as lowercase hexadecimal.

The worker also sends `idempotency-key` equal to the immutable outbox event ID. Consumers should use this value to deduplicate retries because delivery is at-least-once.

Redirects are rejected rather than followed automatically. This prevents a configured endpoint from silently changing its destination during delivery.

Timeouts are normalized to `WEBHOOK_TIMEOUT`, malformed or unsupported endpoint URLs to `INVALID_WEBHOOK_URL`, and non-success HTTP responses to `WEBHOOK_HTTP_<status>` so operational telemetry and retry handling can distinguish failure classes.

## Operational guarantees

- HTTP and HTTPS are the only accepted endpoint protocols.
- Requests have an abort timeout.
- Redirects are not followed.
- Each request carries a stable idempotency key derived from the outbox event ID.
- Multiple configured endpoints are processed sequentially; failure stops the current publication and delegates retry handling to the outbox processor.
- Payloads are not logged by the webhook publisher.
- Existing lease ownership and tenant scoping remain authoritative.

This stage intentionally does not introduce persistent webhook subscriptions, per-tenant endpoint management or an external message broker. Those concerns remain subsequent integration work.
