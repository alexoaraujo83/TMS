# Database / Environment Reconciliation — 2026-09-16

## Scope

Reconcile the canonical `main` database with Neon `development` and `staging`, and verify which application deployments consume the canonical branch.

## Evidence

### Canonical Neon main

- Project: `shiny-hall-34679912`
- Branch: `main` (`br-lingering-shadow-act0vvi`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Role used by the diagnostic: `neondb_owner`.
- **Historical snapshot:** `public.schema_migrations` contained 29 rows at the time this diagnostic was captured.
- **Repository canonical baseline:** 31 migrations, through `0031_finance_relationship_invariants.sql`.
- Public table count: 21.

### Neon development

- Branch: `development` (`br-withered-salad-acjhyf6y`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Role used by the diagnostic: `neondb_owner`.
- `public.schema_migrations` does not exist.
- Public table count: 11.

### Neon staging

- Branch: `staging` (`br-bitter-brook-acpux97x`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Role used by the diagnostic: `neondb_owner`.
- `public.schema_migrations` does not exist.
- Public table count: 11.

## Interpretation

The runtime database evidence in this document is a **point-in-time snapshot** and must not be used as the current repository schema version. The canonical repository migration ledger now contains 31 migrations, through `0031_finance_relationship_invariants.sql`. The captured Neon `main` state had only 29 recorded migrations, so the environment remains **DRIFTED / REQUIRES RUNTIME REVALIDATION** until migrations `0030` and `0031` are demonstrated in the target database.

`development` and `staging` remain materially divergent and cannot be treated as synchronized application environments.

The divergence is not repaired automatically in this audit because migrating or resetting those branches without first proving their consumers and intended lifecycle could destroy useful test data or break an active environment.

## Deployment mapping evidence

### Railway

Project `tms-backup` has one `production` environment.

`tms-worker` is configured from GitHub `alexoaraujo83/TMS`, branch `main`, with start command `node apps/worker/dist/main.js`.

`tms-backup-worker` is configured from the same repository and branch, uses `infra/backup/Dockerfile`, runs `/app/backup.sh`, and has a daily `0 2 * * *` schedule with restart policy `NEVER`.

The legacy/duplicate `backup-worker` service could not be inspected because the connector denied the required viewer role. Therefore it remains UNCLASSIFIED and must not be deleted from this audit.

### Vercel

Project `tms-core-api` is linked to GitHub `alexoaraujo83/TMS`.

The latest listed production deployment is `READY` and was built from `main` at commit `0d5d5ec5405b5af85cace98728f19509b2968245`.

## Decision

- Canonical application/database baseline: `main` + repository migration ledger at 31 migrations.
- Neon `main`: **DRIFTED / REQUIRES RUNTIME REVALIDATION**; captured evidence is historical at 29 migrations.
- `development`: DRIFTED / REQUIRES ENVIRONMENT OWNERSHIP MAPPING.
- `staging`: DRIFTED / REQUIRES ENVIRONMENT OWNERSHIP MAPPING.
- Railway production worker: VERIFIED against GitHub `main`.
- Railway backup worker: VERIFIED against GitHub `main`.
- Vercel production project: VERIFIED against GitHub `main` for the latest listed production deployment.
- `backup-worker`: UNCLASSIFIED; no deletion performed.

## Required next actions

1. Identify whether `development` and `staging` are still consumed by any service or are historical branches.
2. Revalidate Neon `main` after migrations `0030` and `0031` are applied; record the live migration ledger and checksums.
3. If development/staging are active, define a controlled migration path from the canonical migration ledger; do not copy schema manually.
4. If they are historical, preserve evidence and obtain explicit approval before deletion.
5. Verify database connection targets for every active application environment without exposing credentials.
6. After any environment synchronization, execute migration + RLS + IAM + application integration tests and record runtime evidence.

## Audit status

Environment reconciliation remains IN PROGRESS. No destructive database or branch operation was performed.
