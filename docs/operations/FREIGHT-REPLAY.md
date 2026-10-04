# TMS — Freight Status Replay Runbook

## Purpose

This runbook defines the production contract for manually replaying a previously persisted `freight.status_changed` event.

Replay is an operational mutation. It is not a status transition by itself: it creates a new durable-job execution request for an existing event.

## Authorization

The endpoint is protected by:

- `AuthGuard`
- `PermissionGuard`
- `freight:replay`

`freight:replay` is intentionally separate from `freight:update`. Tenant membership and the authenticated tenant context remain mandatory.

An operator without `freight:replay` must not be able to invoke the replay endpoint. Administrative access must be granted through the canonical IAM/bootstrap migrations rather than by bypassing the permission guard.

## HTTP contract

Current NestJS route:

`POST /freights/:id/status-events/:eventId/replay`

Where:

- `:id` is the Freight UUID.
- `:eventId` is the UUID of an existing `freight.status_changed` outbox event belonging to that Freight and tenant.
- The endpoint has no request body.

The service validates:

1. the outbox event exists in the authenticated tenant;
2. `aggregate_type = freight`;
3. `aggregate_id` matches the Freight ID;
4. `event_type = freight.status_changed`;
5. `payload.event_id` matches `:eventId`;
6. `payload.freight_id` matches `:id`.

Invalid or cross-tenant identifiers must not enqueue a replay job.

## Transactional behavior

The replay request runs inside the tenant transaction and performs, atomically:

1. inserts a `durable_jobs` row with job type `freight.status_changed`;
2. generates a fresh `replay:<eventId>:<randomUUID>` idempotency key;
3. records `durable_job.replay_requested` in `audit_events`;
4. returns the event ID, durable-job ID, idempotency key and job status.

A replay request therefore leaves an auditable intent even before the worker claims the job.

## Replay semantics

Manual replay is deliberately **repeatable**.

Each explicit POST represents a new operational intent and receives a new idempotency key. Consequently, two explicit replay requests for the same event may create two durable jobs.

This is different from business-effect idempotency:

- **request level:** not deduplicated;
- **handler level:** idempotent by `event_id`;
- **business audit:** an already-processed event must not create a second `freight.status_changed.processed` audit record.

When the handler encounters an event that was already processed, telemetry records `idempotent_replay=true`.

This contract was recorded as API-03 on 2026-10-04.

## Operational procedure

1. Identify the Freight and exact status-event UUID from status history.
2. Confirm the event belongs to the authenticated tenant.
3. Confirm the transition is the event intended for reprocessing.
4. Use the UI Replay action or the authenticated API route.
5. Confirm the response contains a new durable-job ID.
6. Verify the worker claims and completes the job.
7. Correlate `event_id`, `durable_job_id` and audit records.
8. For a previously processed event, verify `idempotent_replay=true` and no duplicate `freight.status_changed.processed` audit.
9. Do not repeatedly click Replay as a substitute for diagnosing a failed worker. Repeated clicks create separate operational intents by design.

## Audit and observability

Expected audit actions include:

- `durable_job.replay_requested` — one row per explicit replay request;
- `freight.status_changed.processed` — one business-processing audit for an event;
- worker telemetry `freight.status_changed.handled`, with `idempotent_replay=true` when the event was already processed.

Correlation should preserve:

`tenant_id → event_id → durable_job_id → handler telemetry → audit`.

Do not store access tokens, client secrets or other credentials in evidence or audit documentation.

## Safety controls

Replay is a production mutation and must remain subject to:

- dedicated permission;
- tenant scope;
- transactionally recorded audit intent;
- explicit UI confirmation;
- UUID validation;
- payload/event consistency checks;
- idempotent handler behavior.

Rate limiting or an approval workflow is a future hardening option under SEC-03 if operational policy requires it.

## Evidence standard

Code and CI prove the contract but do not by themselves prove production execution.

For an E4 production proof, retain non-secret evidence showing:

- authorized request;
- exact `event_id`;
- returned `durable_job_id`;
- worker claim/completion;
- handler telemetry;
- `idempotent_replay=true` for a previously processed event;
- absence of a duplicate business-processing audit;
- tenant correlation.

The evidence should be read-only after execution wherever possible.
