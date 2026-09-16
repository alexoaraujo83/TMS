# Database / Environment Reconciliation — 2026-09-16

## Scope

Reconcile the canonical `main` database with Neon `development` and `staging`, and verify which application deployments consume the canonical branch.

## Evidence

### Canonical Neon main

- Project: `shiny-hall-34679912`
- Branch: `main` (`br-lingering-shadow-act0vvi9`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Diagnostic role: `neondb_owner`.
- **Current live migration ledger:** 31 rows.
- Latest live migrations include `0031_finance_relationship_invariants.sql`, `0030_compliance_assignment_freight_invariant.sql`, `0029_runtime_app_role.sql`, and `0028_durable_jobs.sql`.
- Public table count: 21.
- Runtime RLS evidence: tenant-owned business tables have RLS enabled and forced; `permissions` and `schema_migrations` are intentionally outside tenant RLS.
- Runtime role evidence: `tms_app` is LOGIN, non-superuser, non-bypass-RLS, and has no CREATE privilege on `public`.
- No production tenant rows currently exist in `public.tenants`.

### Neon development

- Branch: `development` (`br-withered-salad-acjhyf6y`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Diagnostic role: `neondb_owner`.
- `public.schema_migrations` does not exist.
- Public table count: 11.
- Status: **DRIFTED** from the canonical migration baseline.

### Neon staging

- Branch: `staging` (`br-bitter-brook-acpux97x`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Diagnostic role: `neondb_owner`.
- `public.schema_migrations` does not exist.
- Public table count: 11.
- Status: **DRIFTED** from the canonical migration baseline.

## Interpretation

The earlier 29-row Neon `main` result is now superseded by live runtime evidence: `main` currently has the full 31-migration ledger through `0031_finance_relationship_invariants.sql`. The canonical repository and Neon `main` schema baseline are therefore **COMPROVADOS / ALIGNED** for the migration ledger.

`development` and `staging` remain materially divergent and cannot be treated as synchronized application environments. Their lifecycle/ownership must be established before any reset, migration, or deletion is attempted.

No destructive database or branch operation was performed during this reconciliation.

## Deployment mapping evidence

### Railway

Project `tms-backup` has one `production` environment.

`tms-worker` is configured from GitHub `alexoaraujo83/TMS`, branch `main`, with start command `node apps/worker/dist/main.js`. The latest successful runtime deployment is from commit `c2e6833c3c8ad81e98a34f8f40bd34fc4642de35`. A later deployment event for `d905d99206845d230789f16d32cbf579e093de0f` was **SKIPPED**, so the worker is not proven to be running the latest repository commit. Runtime logs show the worker starts successfully, verifies the `tms_app` runtime role, and then enters `idle` because `OUTBOX_TENANT_IDS` is not configured. A direct read of `public.tenants` on Neon `main` currently returns zero tenants, so this idle state is consistent with the current empty production tenant dataset rather than evidence of a failed worker startup.

`tms-backup-worker` is configured from the same repository and branch, uses `infra/backup/Dockerfile`, runs `/app/backup.sh`, and has a daily `0 2 * * *` schedule with restart policy `NEVER`. Its latest deployment for commit `d905d99206845d230789f16d32cbf579e093de0f` is `SUCCESS`.

The legacy/duplicate `backup-worker` service could not be inspected because the connector denied the required viewer role. Its state remains **UNCLASSIFIED** and it must not be deleted from this audit.

### Vercel

Project `tms-core-api` is linked to GitHub `alexoaraujo83/TMS`, uses the NestJS framework, and Node 24.x. Its latest production deployment is `READY` and was built from `main` at commit `d905d99206845d230789f16d32cbf579e093de0f`.

The production `/health` endpoint was queried on 2026-09-16 and returned HTTP 200 with `{"status":"ok","service":"tms-api"}`. Vercel reports no runtime error clusters in the preceding 24 hours.

## Decision

- Canonical repository baseline: `main` + migration ledger at 31 migrations — **COMPROVADO**.
- Neon `main`: 31 migrations live, through `0031` — **COMPROVADO / ALIGNED**.
- Neon `development`: **DRIFTED** / requires environment ownership mapping.
- Neon `staging`: **DRIFTED** / requires environment ownership mapping.
- Railway `tms-backup-worker`: deployment for current `main` commit **SUCCESS**.
- Railway `tms-worker`: runtime **STARTED/IDLE**, but latest repository commit is not proven deployed because the current event for `d905d992...` was skipped. Production currently has zero tenants.
- Railway `backup-worker`: **UNCLASSIFIED**; no deletion performed.
- Vercel `tms-core-api`: current `main` commit deployment **READY** and `/health` **HTTP 200**.

## Required next actions

1. Identify whether `development` and `staging` are still consumed by any service or are historical environments.
2. Keep Neon `main` as the canonical 31-migration baseline; do not create a corrective migration solely for the prior historical 29-row observation.
3. Verify database connection targets for every active application environment without exposing credentials.
4. Decide whether `tms-worker` should be explicitly redeployed from the current `main` commit after confirming its intended production tenant lifecycle. Do not populate `OUTBOX_TENANT_IDS` with invented or unapproved tenant IDs.
5. Verify backup execution evidence (artifact creation, retention, restore test) independently of deployment status.
6. After any environment synchronization, execute migration + RLS + IAM + application integration tests and record runtime evidence.

## Audit status

GATE 03 Environment & Deployment Integrity remains **IN PROGRESS**. Canonical production database alignment and API health are now runtime-proven. Remaining blockers are environment drift (`development`/`staging`), worker deployment freshness/tenant lifecycle, and independent backup/restore evidence.
