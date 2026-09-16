# Database / Environment Reconciliation — 2026-09-16

## Scope

Reconcile the canonical `main` database with Neon `development` and `staging`, and verify which application deployments consume the canonical branch.

## Evidence

### Canonical Neon main

- Project: `shiny-hall-34679912`
- Branch: `main` (`br-lingering-shadow-act0vvi9`)
- Database: `neondb`
- Runtime SQL executed against the branch on 2026-09-16.
- Role used by the diagnostic: `neondb_owner`.
- `public.schema_migrations`: 29 rows.
- Latest recorded migration: `0029_runtime_app_role.sql`.
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

`main` is the only branch currently demonstrated to contain the canonical migration ledger through `0029_runtime_app_role.sql`. `development` and `staging` are materially divergent and cannot be treated as synchronized application environments.

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

- Canonical application/database baseline: `main` + Neon `main`.
- `development`: DRIFTED / REQUIRES ENVIRONMENT OWNERSHIP MAPPING.
- `staging`: DRIFTED / REQUIRES ENVIRONMENT OWNERSHIP MAPPING.
- Railway production worker: VERIFIED against GitHub `main`.
- Railway backup worker: VERIFIED against GitHub `main`.
- Vercel production project: VERIFIED against GitHub `main` for the latest listed production deployment.
- `backup-worker`: UNCLASSIFIED; no deletion performed.

## Required next actions

1. Identify whether `development` and `staging` are still consumed by any service or are historical branches.
2. If they are active, define a controlled migration path from the canonical migration ledger; do not copy schema manually.
3. If they are historical, preserve evidence and obtain explicit approval before deletion.
4. Reconcile repository documentation that still states migration `0028_durable_jobs.sql` as the latest migration; canonical main is now at `0029_runtime_app_role.sql`.
5. Verify database connection targets for every active application environment without exposing credentials.
6. After any environment synchronization, execute migration + RLS + IAM + application integration tests and record runtime evidence.

## Audit status

Environment reconciliation remains IN PROGRESS. No destructive database or branch operation was performed.
