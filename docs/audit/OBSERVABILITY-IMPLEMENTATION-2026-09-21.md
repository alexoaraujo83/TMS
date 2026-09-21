# TMS — Centralized Observability Implementation — 2026-09-21

## Scope

Applied against canonical repository alexoaraujo83/TMS, branch feat/centralized-observability.

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
| Worker logging | EXISTING / PARTIAL CENTRALIZATION | worker emits JSON but full package migration remains |
| Frontend logging | NOT YET VALIDATED | no runtime evidence |
| Runtime production validation | NOT YET PROVEN | CI/runtime execution pending |

## Next validation

Run format, lint, typecheck, tests and build through CI. Then perform runtime smoke validation and update the SSOT/evidence ledger.
