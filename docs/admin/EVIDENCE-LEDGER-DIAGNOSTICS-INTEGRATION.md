# TMS Evidence Ledger and diagnostics integration

Status: implemented in the pull request. Code/test HEAD `6067781732a1162b2bf6e0341c083800fe39223b` passed CI run [38093421408](https://github.com/alexoaraujo83/TMS/actions/runs/38093421408) and platform tooling run [38093421411](https://github.com/alexoaraujo83/TMS/actions/runs/38093421411) on 2026-10-10. Deployment of both Web and API for that HEAD and live Auth0/diagnostic-source verification remain pending because the free Vercel deployment quota is exhausted; no upgrade or card was requested. This status entry documents the verified code/test HEAD before the evidence-document update.

## Schema compatibility

The repository uses existing migrations; this feature does not add or alter migrations.

- Migration 0008 defines audit_events with tenant_id, request_id, entity_id, action, entity_type, and created_at.
- Migration 0032 adds correlation_id and outcome to audit_events.
- Migration 0026 defines tenant-scoped outbox_events with id, aggregate_id, event_type, status, and created_at.
- Migration 0028 defines tenant-scoped durable_jobs with id, job_type, status, created_at, and updated_at.
- Migration 0033 adds durable_jobs.idempotency_key and its tenant-scoped uniqueness index.
- The existing withTenantContext helper establishes app.tenant_id in a transaction. Repository searches also include tenant_id in every source query and use bound query parameters.

## Implemented contract

API endpoint: GET /admin/diagnostics?kind=...&value=...&limit=...

Permission: ops:diagnostics, enforced by AuthGuard and PermissionGuard. The tenant identifier is derived from the verified RequestContext; the browser cannot select a tenant.

Supported identifier mappings:

| kind | Source and column |
| --- | --- |
| requestId | audit_events.request_id |
| correlationId | audit_events.correlation_id |
| outboxEventId | outbox_events.id |
| outboxAggregateId | outbox_events.aggregate_id |
| durableJobId | durable_jobs.id |
| idempotencyKey | durable_jobs.idempotency_key |
| freightId | audit_events.entity_id and outbox_events.aggregate_id |

Validation rejects unsupported kinds, empty/control-character values, values over 200 characters, malformed UUIDs for UUID identifiers, and limits outside 1–50. The default limit is 25. All SQL values are parameterized; SQL column names come only from a fixed allowlist.

The response contains source, record identifier, timestamp, status, a bounded summary, source coverage, and either success or no_results. It does not return database payloads, last_error, tokens, cookies, secrets, connection strings, raw IP addresses, or before/after states. Source/database availability failures return HTTP 503; unexpected query failures return HTTP 500. Neither is represented as an empty result.

## Web integration

The authenticated Next.js BFF is /api/tms/admin/diagnostics. It forwards only kind, value, and limit to the protected API and disables caching. The Admin interface submits a real request, renders sanitized matches, and distinguishes authentication failure, missing permission, invalid input, unavailable source, query failure, and a successful empty result.

## Verification gates

Automated repository tests cover empty results, result bounds, malformed values, tenant parameter/RLS context, source failures, and the migration-backed idempotency column. A PostgreSQL integration test uses the existing migrations, re-enables/forces RLS, and queries audit, outbox, durable-job idempotency, and freight identifiers using duplicate identifiers across two tenants. API controller tests cover permission metadata, tenant derivation, supported query validation, and bounded limits; service tests distinguish transient database outages (503) from schema/permission faults (500).

Do not promote runtime evidence based on code presence or a preview deployment alone. Record the actual CI run, Web preview state, and a real authenticated API query after those checks finish. Live cross-tenant PostgreSQL/RLS evidence and end-to-end Web-to-worker event correlation remain separate runtime gates.
