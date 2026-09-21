# TMS — Centralized Observability Implementation — 2026-09-21

## Scope

Applied against canonical repository alexoaraujo83/TMS, worker follow-up branch fix/blk-worker-01-freight-status-flow-2026-09-21, based on the PR #62 head.

## Existing baseline reused

- API already had request correlation primitives and completion telemetry.
- @tms/audit and audit_events already existed.
- PostgreSQL RLS already protected audit_events.
- Worker already emitted structured JSON operational events.

The implementation therefore extends existing primitives instead of creating duplicate mechanisms.

## Changes

- Added @tms/observability structured logger package.
- Added centralized recursive redaction.
- Added correlation fields to API request telemetry.
- Added correlation ID to RequestContext.
- Added audit context fields and migration 0032.
- Updated audit repository to persist the new optional fields.
- Added automated redaction and structured-log tests.
- Updated request telemetry/auth context tests.
- Added observability documentation.
- Added the real `freight.status_changed → outbox_events → durable_jobs → freight-status-changed.handler.ts → audit/telemetry` path.
- Added durable-job idempotency keyed by outbox event ID.
- Added handler replay protection and automated handler coverage.

## Evidence level

| Item | Status | Evidence |
|---|---|---|
| Structured logger | IMPLEMENTED | package source + tests |
| Redaction | IMPLEMENTED | executable package test |
| Request ID | INTEGRATED | API middleware |
| Correlation ID | INTEGRATED | API middleware/context |
| Access telemetry | INTEGRATED | API completion middleware |
| Audit persistence | INTEGRATED | existing audit repository + migration |
| Audit RLS | EXISTING / PRESERVED | migration 0008 |
| Worker logging | INTEGRATED / PARTIAL VALIDATION | centralized logger plus durable/outbox telemetry and status handler |
| Frontend logging | IMPLEMENTED / NOT RUNTIME-VALIDATED | PR #62 source/tests; Vercel preview blocked by provider rate limit |
| BLK-WORKER-01 | IMPLEMENTED / NOT RUNTIME-PROVEN | PR #63 source path + handler test; real Neon/Railway execution pending |

## Next validation

Run format, lint, typecheck, tests and build through CI. Then perform runtime smoke validation and update the SSOT/evidence ledger.

## CI validation trigger

PR #63 is now targeted at `main` so the canonical GitHub CI workflow can validate the combined observability/worker change set. No CI result is promoted until an actual workflow run is observed.
