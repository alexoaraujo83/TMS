# Runtime database role audit

## Scope

Audit of the application, worker and integration-test database connection paths after the runtime role hardening migration.

## Evidence

- `packages/database/src/pool.ts` creates a PostgreSQL pool from `connectionString` and does not select a PostgreSQL role itself.
- `apps/api/src/common/database.module.ts` supplies `process.env.DATABASE_URL` directly to that pool.
- `apps/worker/src/main.ts` creates a PostgreSQL `Pool` directly from `process.env.DATABASE_URL`.
- Tenant-aware repository transactions use `set_config('app.tenant_id', tenantId, true)` before tenant-owned queries.
- Neon production database contains `tms_app` with `BYPASSRLS=false`, no superuser/create-role/create-database privileges, and the required schema/table/function grants after the corrective role migration.
- `packages/database/test/security.integration.test.ts` separates an administrative fixture/cleanup connection (`DATABASE_ADMIN_URL`) from the restricted runtime connection (`DATABASE_URL`). All tenant-isolation assertions use the runtime pool.
- CI runs the migration with the administrative connection, creates a random CI-only password for `tms_app`, and exports a runtime-only `DATABASE_URL` for the integration suite. The generated credential is not committed.

## CI execution evidence

- GitHub Actions CI run `#651` (`35018451926`) for commit `e7da9788358c064847cb84c6fcfc75f44d3ce247` completed successfully.
- Database migration completed successfully before the restricted runtime credential was provisioned.
- The CI runtime-role credential provisioning step completed successfully.
- `pnpm format:fix`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` all completed successfully in the same run.
- The CI integration suite therefore executed with the restricted runtime connection path configured by the workflow rather than the administrative fixture connection.

## Credential provisioning evidence

- An earlier Neon API role recreation path generated a login credential but produced a role with privileged role attributes, including RLS bypass; that state was not accepted for application runtime use.
- The privileged recreation was removed, including the temporary `tms_app_runtime` role.
- `tms_app` was recreated through the database migration path with explicit `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` and the required grants.
- Temporary-branch validation proved the recreated role had `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, `rolcanlogin=true`, and `rolbypassrls=false` before applying the migration to production.
- Production read-only validation now reports `tms_app` with `authentication_method=password` and the same restricted role attributes. The role has schema usage, freight SELECT/INSERT, and membership-function EXECUTE; it does not have INSERT privilege on `schema_migrations`.
- No production credential is committed to source control.

## Production runtime adoption evidence

- Production Vercel deployment `dpl_3D9o6Ri3oGgveW6GG5Cf2ZwcF94Q` is `READY` and targets `main` at merge commit `ac0471e9887ee003f9d4c4030dac47fedaed61ca`.
- The deployed `/ready` endpoint returned HTTP `200 OK` with `{"status":"ready","service":"tms-api"}` on 2026-09-15.
- The readiness implementation explicitly queries `current_user` and rejects any runtime database identity other than `tms_app`; therefore a successful production readiness response is runtime evidence that the deployed API authenticated through the restricted `tms_app` role.

## Current state

**Database role hardening: COMPROVADO.**

**CI restricted-role integration architecture: COMPROVADO.**

**CI quality/test/build pipeline: COMPROVADO — Run #651 passed.**

**Production credential availability: COMPROVADO — Neon management metadata reports password authentication for `tms_app`.**

**Production API runtime role adoption: COMPROVADO — production deployment readiness passed only with `current_user='tms_app'`.**

**Worker production runtime role adoption: PENDENTE DE EVIDÊNCIA.**

The worker has a separate `DATABASE_URL` path and must not be changed blindly because backup/restore services can legitimately require elevated database privileges. Its effective production role requires a dedicated runtime execution check before being classified.

## Residual gate

1. Determine whether the worker's production `DATABASE_URL` is an application runtime credential or an administrative backup/restore credential.
2. If it is an application runtime credential, prove that the worker connects as `tms_app` (or a separately approved least-privilege worker role) and validate its required operations.
3. Preserve elevated backup/restore credentials separately where required; do not reuse the application runtime role for administrative recovery operations.
4. Continue final P1 audit closure only after worker identity and operational-role separation are evidenced.

Until the worker path is evidenced, P0 API database runtime isolation is fully proven, while the broader application/worker runtime-role gate remains **PARTIAL**.

## CI validation branch

This branch exists only to execute GitHub Actions against the current `main` state after the database integration-test concurrency and CI administrative-role corrections.
