# TMS Implementation Roadmap

## Stage 0 — Foundation

- repository and monorepo conventions
- CI gates
- environment contract
- configuration validation
- API/Web/Worker bootstraps
- database package and migration pipeline
- logging/correlation primitives

## Stage 1 — Security and tenancy

- tenant model
- users and identities
- memberships
- roles and permissions
- immutable TenantContext
- authorization guards/policies
- PostgreSQL RLS
- negative cross-tenant tests
- audit foundation

## Stage 2 — Master data

- parties
- customers
- carriers
- drivers
- vehicles
- addresses
- documents/reference data

## Stage 3 — Freight lifecycle

- transport request
- cargo and dimensions
- stops and route
- quotation
- negotiation
- contracting
- lifecycle invariants

## Stage 4 — Matching and capacity

- availability
- capacity
- qualification
- matching rules
- candidate generation
- scoring
- ranking
- assignment

## Stage 5 — Trip execution

- trip creation
- pickup
- transit
- occurrences
- delivery
- proof of delivery
- operational timeline

## Stage 6 — Compliance

- document validity
- GR/risk controls
- blocks and releases
- compliance audit

## Stage 7 — Finance

- cost
- revenue
- payable/receivable
- settlement
- payment
- reconciliation
- margin
- idempotency

## Stage 8 — Reliability and integrations

- outbox
- worker
- retries
- dead-letter
- webhooks
- notifications
- external integrations

## Stage 9 — Analytics and AI

- operational read models
- KPIs
- dashboards
- anomaly detection
- matching optimization
- forecasting

## Stage 10 — Production hardening

- load tests
- security assessment
- backup/restore drill
- observability
- disaster recovery
- cost/performance tuning
- production readiness review

### Stage 10.5 — Webhook Delivery Foundation

- HTTP(S) webhook publisher over the existing outbox
- timeout and protocol validation
- optional HMAC-SHA256 signing
- delivery failures delegated to existing outbox retry/lease semantics
- executable unit coverage
- operational documentation

### Stage 10.6 — Webhook Reliability and Security Hardening

- stable `idempotency-key` derived from the immutable outbox event ID
- reject redirects instead of following them automatically
- normalize malformed URL and timeout failures
- preserve existing outbox lease ownership, tenant isolation and retry semantics
- executable reliability/security unit coverage
- document at-least-once delivery and consumer-side deduplication requirements

### Stage 10.8 — API Readiness

- keep `/health` as liveness-only
- make `/ready` validate database connectivity
- return service-unavailable when the database cannot be reached
- executable controller coverage for healthy and unavailable database states

### Stage 10.9 — API Request Observability

- completion telemetry with request correlation
- HTTP method, path, status and duration measurements
- no request/response payload or credential logging
- executable middleware coverage
- documented telemetry contract

### Stage 10.9a — API Telemetry Failure Isolation

- isolate telemetry sink exceptions from the request lifecycle
- preserve process stability when telemetry emission fails
- executable failure-isolation coverage

### Stage 10.10 — Backup and Restore Readiness

- define an evidence-driven non-production restore drill
- verify snapshot/recovery-point restoration into an isolated branch
- validate restored schema and migration compatibility
- measure and record tested RTO and RPO
- preserve recovery evidence without exposing credentials
- keep production readiness **NOT PROVEN** until a real restore drill succeeds

### Stage 10.11 — Disaster Recovery / Restore Evidence

- execute a real snapshot creation and restore
- validate restored PostgreSQL version, schema, table inventory and migration state
- record observed restore duration without treating it as an approved RTO target
- distinguish recovery mechanism proof from safe isolated production-readiness proof
- require `finalize: false` for future routine isolated drills
- require explicit approval before deleting temporary recovery branches
- keep backup/recovery readiness **NOT PROVEN** until isolated recovery, recurring policy, RPO and RTO targets are established

No stage is considered production-ready merely because its UI exists. Completion requires end-to-end traceability and passing quality/security gates.


## Current audit reconciliation — 2026-10-02

| Area | Status | Evidence / next gate |
|---|---|---|
| Stage 0 Foundation | IMPLEMENTED | monorepo, CI, config, Web/API/Worker |
| Stage 1 Security/Tenancy | IMPLEMENTED FOUNDATION | Auth0, IAM, tenant context, RLS; DB-04/E4 runtime evidence remains a gate |
| Stages 2–7 | IMPLEMENTED FOUNDATIONS in several domains | expand domain use cases and end-to-end coverage before calling complete |
| Stage 8 Reliability | IMPLEMENTED FOUNDATION | durable jobs/outbox/webhooks need continued hardening and external contract evidence |
| Stage 9 Analytics/AI | PLANNED | start after stable domain/event contracts |
| Stage 10.10/10.11 DR | PARTIALLY PROVEN | isolated restore mechanism proven; recurring policy, ownership, retention, RPO/RTO not proven |
| Restore UI automation | IN PROGRESS | PR #121 is open/draft; do not describe its changes as merged |
| Documentation governance | CURRENT | audit and schema docs reconciled on 2026-10-02 |

Production readiness remains evidence-driven: implementation, CI, preview deployment and production runtime proof are separate gates.
