# TMS Admin Control Center — Implementation Roadmap

## Purpose

Evolve `/admin` into an operational control center without representing unverified infrastructure state as healthy. Existing project-control data remains the source of truth for modules, stages, evidence, and blockers.

## Implemented in this change

- Search recent evidence by code, title, kind, status, source, or reference.
- Search active blockers by code, title, severity, status, description, next action, or module.
- Show filtered and total item counts so users can distinguish a filtered list from the full list.
- Keep filters client-side and scoped to data already returned by the existing authorized project-control endpoint.

## Required follow-up work

### P0 — Security and correctness
- Validate real Auth0 user login, tenant claim, RBAC, and positive/negative tenant isolation.
- Diagnose freight PATCH failures from the actual HTTP response and verify persistence plus audit records.
- Configure and verify branch protection and required CI checks in GitHub repository settings.
- Add regression tests for admin access and authorization boundaries.

### P1 — Operational health
- Introduce an authenticated server-side health aggregator for Web, API, Auth0 configuration checks, PostgreSQL, worker, durable jobs/outbox, and backup/restore verification.
- Each health result must include source, checkedAt, environment, status, and a safe summary. Unknown/stale evidence must not be shown as healthy.
- Expose job counts and oldest pending age without returning credentials, connection strings, raw tokens, or sensitive payloads.
- Correlate requestId/correlationId, freight ID, event ID, idempotency key, and worker job ID in diagnostics.

### P1 — Evidence ledger
- Record source URL, commit/run/deployment reference, timestamp, environment, result, evidence level, and invalidation reason.
- Promote a gate only when its acceptance criteria are met by current evidence; code existence alone is insufficient.

### P2 — Administration
- Add user/membership/role management only after server-side RBAC and tenant-scoped authorization tests are in place.
- Add immutable administrative audit events and explicit confirmation for destructive or replay actions.

## Acceptance criteria

- Evidence and blocker search works with empty, partial, and no-match queries.
- Counts reflect the filtered and total rows.
- Existing project-control loading, error, and retry states remain functional.
- Formatting, lint, typecheck, tests, and build pass in CI.
- Independent review approves the PR before merge.
- No secret or credential value is exposed to browser code or logs.

## Out of scope for this UI-only increment

No database schema, Auth0 configuration, production data, tenant permissions, branch protection, worker settings, or production deployment was changed by this increment. Those are separate operations requiring their own authorization, tests, and evidence.
