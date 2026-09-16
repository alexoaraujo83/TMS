# P0 Database / RLS / IAM Audit — 2026-09-16

## Objective

Continue the canonical TMS database security audit from `main` without reopening already-proven application work. The gate requires behavioral evidence from a non-superuser, `NOBYPASSRLS` runtime role.

## Finding addressed

`public.check_tenant_membership(text, uuid)` is the authoritative Auth0-subject membership resolver. Migration `0020_auth0_subject_identity.sql` revokes `PUBLIC` execution and defines the `(text, uuid)` signature. The runtime proof therefore grants execution to the ephemeral application role without creating credentials in migrations.

## Correction

No additional migration is retained: the canonical runtime-role migration already provisions the intended `tms_app` posture and resolver execution privilege. The earlier duplicate runtime-grant migration remains excluded.

The CI workflow provisions an ephemeral `tms_ci_admin` account for administrative fixtures and uses `tms_app` as the non-bypass runtime role. The normal quality chain receives `DATABASE_URL` as the runtime role; dedicated integration tests use `DATABASE_ADMIN_URL` only for fixture setup and cleanup and `RUNTIME_DATABASE_URL` for runtime assertions.

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
3. Provision the restricted `tms_app` runtime credential and temporary `tms_ci_admin` administrative credential.
4. Export the runtime credential to `DATABASE_URL` and `RUNTIME_DATABASE_URL`.
5. Run the dedicated RLS and IAM integration tests.
6. Run the existing quality chain: `pnpm format:fix` → `pnpm format:check` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`.

## Evidence rule

This audit remains **PENDING** until GitHub Actions completes successfully for the new branch/PR and the dedicated runtime tests are visible as successful steps. A deployment or file presence alone is not considered proof.

## Next gate

After green CI:

1. inspect the live canonical PostgreSQL catalog for production role attributes and ownership;
2. reconcile `nexora_app`/`tms_app` naming against the actual deployed environment;
3. verify RLS and privilege posture in the live database;
4. then proceed to the Durable Jobs lease/idempotency audit.
