# P0 Database / RLS / IAM Audit — 2026-09-16

## Objective

Continue the canonical TMS database security audit from `main` without reopening already-proven application work. The gate requires behavioral evidence from a non-superuser, `NOBYPASSRLS` runtime role.

## Finding addressed

`public.check_tenant_membership(text, uuid)` is the authoritative Auth0-subject membership resolver. Migration `0020_auth0_subject_identity.sql` revokes `PUBLIC` execution and defines the `(text, uuid)` signature. The runtime proof must therefore grant execution to the ephemeral application role without creating credentials in migrations.

## Correction

No additional migration was retained: the canonical `0029_runtime_app_role.sql` already provisions the intended `tms_app` role posture and grants the resolver execution privilege. The earlier duplicate `0029_iam_runtime_execute_grant.sql` was removed.

The CI workflow independently provisions an ephemeral `tms_app` role as `NOSUPERUSER NOBYPASSRLS`, grants only the database access required for the integration proofs, and supplies its credential through `GITHUB_ENV`. The normal quality chain continues to receive `DATABASE_URL` as the runtime role; dedicated integration tests use `DATABASE_ADMIN_URL` only for fixture setup and cleanup.

## Behavioral proofs added

`packages/database/test/rls-runtime.integration.test.ts` proves with the runtime role:

- cross-tenant reads are invisible;
- cross-tenant inserts are rejected with PostgreSQL privilege/RLS denial;
- tenant reassignment on update is rejected;
- cross-tenant deletes do not affect another tenant's row;
- transaction-local tenant context does not leak through pool reuse.

`packages/database/test/iam-runtime.integration.test.ts` proves:

- the runtime role can execute the authoritative resolver;
- `PUBLIC` cannot execute the resolver;
- Auth0 subject resolution returns the expected internal user, tenant, role, and active state.

## CI execution order

1. Install dependencies.
2. Run canonical migrations using the administrative database connection.
3. Provision `tms_app` with `NOSUPERUSER NOBYPASSRLS` and a random ephemeral password.
4. Grant table/sequence/function access required for runtime behavior and explicitly remove `schema_migrations` access.
5. Export the same runtime credential to both `DATABASE_URL` and `RUNTIME_DATABASE_URL` for the appropriate quality and dedicated-test paths.
6. Validate runtime role attributes and resolver privileges.
7. Run the dedicated RLS and IAM integration tests.
8. Run the existing quality chain: `pnpm format:fix` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`.

## Evidence rule

This audit remains **PENDING** until GitHub Actions completes successfully for the new branch/PR and the dedicated runtime tests are visible as successful jobs. A deployment or file presence alone is not considered proof.

## Next gate

After green CI:

1. inspect the live canonical PostgreSQL catalog for production role attributes and ownership;
2. reconcile `nexora_app`/`tms_app` naming against the actual deployed environment;
3. verify RLS and privilege posture in the live database;
4. then proceed to the Durable Jobs lease/idempotency audit.
