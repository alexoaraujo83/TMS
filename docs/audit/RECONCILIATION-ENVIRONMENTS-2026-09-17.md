# TMS — Environment Reconciliation — 2026-09-17

## Scope

Fresh read-only reconciliation of the canonical Neon project `tms` across `main`, `development` and `staging`. No branch reset, deletion, migration, credential rotation or schema synchronization was performed.

## Canonical production database

- Neon project: `tms` (`shiny-hall-34679912`)
- Canonical branch: `main`
- Branch state: `ready`
- `main` is the primary/default branch.
- Database: `neondb`
- Current `public` table count: 21.
- `neon_auth` table count: 9.
- `public.schema_migrations`: present.
- Migration count: 31.
- Highest recorded migration: `0031_finance_relationship_invariants.sql`.

## Development branch

- Branch: `development`
- State: `ready`
- Created from parent data on 2026-09-12.
- Current `public` table count: 11.
- `public.schema_migrations`: absent.
- Current schema is materially behind `main`.
- Direct schema comparison shows missing production-era domains including Durable Jobs, finance, assignments, GR requests, outbox, trips and trip-related tables, plus Neon Auth objects and several database functions, constraints, indexes, triggers, RLS policies and grants present on `main`.

**Classification:** DRIFTED / NOT MIGRATION-ALIGNED.

## Staging branch

- Branch: `staging`
- State: `ready`
- Created from parent data on 2026-09-12.
- Current `public` table count: 11.
- `public.schema_migrations`: absent.
- Direct schema comparison shows the same class of material divergence from `main` as `development`, including missing Durable Jobs, finance, assignments, GR, outbox and trip domains and associated database security/integrity objects.

**Classification:** DRIFTED / NOT MIGRATION-ALIGNED.

## Important finding

The drift is not a simple one-or-two migration lag. `development` and `staging` represent an older schema lineage. The difference includes entire tables, functions, constraints, indexes, triggers, RLS policies and grants. Therefore an automatic `migrate` or branch reset cannot be treated as a safe synchronization operation without first establishing whether either branch has active consumers or data that must be preserved.

## Environment matrix

| Environment | Neon branch | Schema state | Migration ledger | Consumer/deployment | Action |
|---|---|---|---|---|---|
| Development | `development` | 11 public tables; materially behind `main` | absent | Not yet proven | Establish ownership/consumer before sync |
| Staging | `staging` | 11 public tables; materially behind `main` | absent | Not yet proven | Establish ownership/consumer before sync |
| Production | `main` | 21 public tables + 9 Neon Auth tables | 31 migrations through `0031` | Production consumers partially reconciled | Preserve |

## Safety decision

No destructive or corrective database operation is authorized by this audit step. Specifically:

- do not reset `development`;
- do not reset `staging`;
- do not delete branches;
- do not run production migrations merely to reconcile branch names;
- do not copy data between environments;
- do not assume the absence of `schema_migrations` means the branch is disposable.

## Evidence

- Neon branch inventory directly queried on 2026-09-17.
- `main` database table inventory directly queried.
- `development` and `staging` table inventories directly queried.
- `main` migration ledger directly queried: 31 rows, max `0031_finance_relationship_invariants.sql`.
- `development` and `staging` directly queried: `public.schema_migrations` absent and 11 public tables.
- Neon schema comparisons directly executed from `development` → `main` and `staging` → `main`.

## Blocker routing

**BLK-001 — Environment drift** remains ACTIVE and is strengthened from historical evidence to current direct evidence.

Required next evidence:
1. Identify all current Railway/Vercel consumers of `development` and `staging`.
2. Identify deployment SHAs for those consumers.
3. Identify whether either branch contains non-test data or active operational state.
4. Reconcile environment variable names/targets without exposing values.
5. Only then choose between migration-forward, branch replacement, archival, or other controlled synchronization.

## Next logical stage

Continue CHAT 14 — Environments with consumer/deployment mapping and environment-variable topology. Do not perform destructive database synchronization until those dependencies are proven.
