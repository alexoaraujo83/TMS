# TMS Evidence Ledger and Diagnostics Integration

Status: implementation contract / discovery baseline. This document is not runtime evidence and does not claim the integrations are complete.

## Confirmed existing sources

- `project_control_evidence` is defined by migration `0040_project_control_center_reconciliation.sql`. Existing fields include `tenant_id`, optional `module_id` and `stage_id`, `evidence_code`, `title`, `kind`, `status` (`pending|valid|invalid|expired`), `source`, `reference`, `captured_at`, and JSONB `metadata`.
- `audit_events` is defined by migration `0008_audit_events.sql` and extended by `0032_observability_audit_context.sql`. It contains `tenant_id`, `action`, `entity_type`, `entity_id`, `request_id`, `correlation_id`, `outcome`, metadata and timestamps. RLS is enabled and forced.
- `outbox_events` is defined by `0026_outbox_foundation.sql`. It contains tenant scope, event type, aggregate identity, status, attempts, scheduling/publish timestamps and last error. RLS is enabled and forced.
- `durable_jobs` is defined by `0028_durable_jobs.sql`. It contains tenant scope, job type, status, attempts, scheduling, completion, last error and timestamps. RLS is enabled and forced.
- The existing Project Control API exposes `GET /project-control/dashboard`, protected by `AuthGuard`, `PermissionGuard`, and `project:read`. The Next.js proxy at `apps/web/src/app/api/tms/project-control/route.ts` forwards that existing contract with the Auth0 fetcher.
- The current admin diagnostics form only prepares a query message. It explicitly says no logs are queried. Do not describe it as a functioning log search.

## Implementation rules

1. Do not add a new table or endpoint until its owner, API contract, permissions, and source queries are reviewed against the existing module structure.
2. Any diagnostics search must use a server-side authenticated path, derive tenant ID from the verified request context, use parameterized SQL, cap result count, and never accept tenant ID from the browser as an authority.
3. Query only known fields and tables. Do not use broad payload substring searches as proof of correlation; a match must be based on a defined correlation key and be labeled with its source.
4. Normalize records with source, event timestamp, record ID, correlation key, outcome/status, and a redacted summary. Never return tokens, cookies, secrets, connection strings, raw IP addresses, or unfiltered before/after states.
5. Distinguish `success with results`, `success with no results`, `forbidden`, `source unavailable`, and `query failed`. A failed source must not be rendered as a healthy empty result.
6. Preserve existing RLS and tenant-context transaction helpers. Add negative tests proving tenant A cannot retrieve tenant B records.
7. Evidence levels E0-E4 must not be inferred from `project_control_evidence.status` alone. Promote a level only when the corresponding acceptance criteria and verifiable artifact are present.
8. Keep this work separate from PR #148, whose scope is operational-health refresh and snapshot clarity.

## Implementation sequence

- [ ] Inspect package exports, module registration, DTO validation conventions, and current integration-test setup before changing APIs.
- [ ] Add a typed, tenant-scoped repository query for supported identifiers. Initially support only identifiers with explicit schema mappings (audit request/correlation ID, outbox event/aggregate ID, durable job ID); report unsupported identifier types rather than guessing.
- [ ] Add a guarded API contract with bounded pagination and validated identifier type/value.
- [ ] Add an Auth0-backed Next.js proxy that forwards the authenticated request without exposing credentials.
- [ ] Wire the Admin diagnostics form to the real proxy; show source-by-source results and explicit partial/unavailable/error states.
- [ ] Add repository tests, API authorization tests, tenant-isolation negative tests, redaction tests, and UI tests for empty/error/stale states.
- [ ] Run CI and deployment smoke tests; attach actual run IDs and test artifacts to the Evidence Ledger.
- [ ] Only then mark this integration as implemented. Until these checks pass, status remains BLOCKED / NOT RUN as appropriate.

## Current finding

Schema-level sources for audit, outbox, durable jobs, and project-control evidence exist in the repository. Their existence does not prove that production records are populated, correlated end-to-end, or queryable from the Admin UI. Runtime verification remains outstanding.
