# Runtime database role audit

## Scope

Audit of the application and worker database connection path after the runtime role hardening migration.

## Evidence

- `packages/database/src/pool.ts` creates a PostgreSQL pool from `connectionString` and does not select a PostgreSQL role itself.
- `apps/api/src/common/database.module.ts` supplies `process.env.DATABASE_URL` directly to that pool.
- `apps/worker/src/main.ts` creates a PostgreSQL `Pool` directly from `process.env.DATABASE_URL`.
- Tenant-aware repository transactions use `set_config('app.tenant_id', tenantId, true)` before tenant-owned queries.
- Neon production database now contains `tms_app` with `BYPASSRLS=false`, no superuser/create-role/create-database privileges, and the required schema/table/function grants.

## Current state

**Database role hardening: COMPROVADO.**

**Runtime role adoption: PENDENTE DE EVIDÊNCIA.**

The application and worker source code do not force `tms_app`; therefore the effective runtime role is determined entirely by the credential embedded in `DATABASE_URL`. The production `DATABASE_URL` has not yet been rotated to a `tms_app` credential.

## Required next gate

1. Provision/reset the `tms_app` credential without committing it to source control.
2. Update API and worker production `DATABASE_URL` values to use `tms_app`.
3. Execute behavioral RLS tests using the real runtime credential.
4. Prove tenant A/B read, insert, update and delete isolation, missing-context denial, transaction-scoped context, connection-pool reuse, and membership-function execution.
5. Re-run format, lint, typecheck, test, build, migration validation and deployment health checks.

Until these steps are evidenced, P0 database runtime isolation remains **not fully proven** even though the database role itself is hardened.
