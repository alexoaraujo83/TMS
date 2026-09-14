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

### Production Hardening — API Request Observability

- completion telemetry with request correlation
- HTTP method, path, status and duration measurements
- no request/response payload or credential logging
- executable middleware coverage
- documented telemetry contract

No stage is considered production-ready merely because its UI exists. Completion requires end-to-end traceability and passing quality/security gates.
