# TMS — Single Source of Truth (SSOT) Operational State

Evidence-ledger snapshot. This document records verified state only; it is not a substitute for deployment/runtime evidence.

## Canonical source

- Repository: alexoaraujo83/TMS
- Canonical branch: main

## Current Vercel production state

Canonical projects:
- tms-web — PRESERVE
- tms-core-api — PRESERVE

Previously authorized cleanup targets remain absent:
- transportadora — REMOVED
- alexoaraujo83-agenciador — REMOVED
- agenciador — REMOVED
- nextjs-boilerplate — REMOVED

### tms-web

- Latest observed production deployment: dpl_6tjaoPvaLGKMgaRW5Sarg3M4AKZ5
- State: READY
- Git ref: main
- Git SHA: f9bb9d4225a777f4c2bc899c4008e2e0b2dd4d91
- Target: production
- Production aliases include tms-web-chi.vercel.app
- Fresh runtime-log query for the current deployment: no current errors reproduced in the inspected window.

### tms-core-api

- Latest observed READY production deployment: dpl_HHjzqyoPFpE6RD5GcWVvGszN5YBy
- READY production SHA: f9bb9d4225a777f4c2bc899c4008e2e0b2dd4d91
- Production API /health: HTTP 200, response status=ok, service=tms-api.
- Current production API deployment is independently verified as READY on current main SHA.

### Production parity classification

- Web current-main production parity: PASS for deployment state on f9bb9d4.
- API current-main production parity: PASS for deployment state on f9bb9d4.
- Both canonical production deployments are READY on the same current application SHA f9bb9d4.

## Railway

Current topology:
- tms-worker — PRESERVE
- tms-backup-worker — PRESERVE
- legacy backup-worker — REMOVED

tms-worker current-main deployment parity: PASS for deployment status. Deployment e1db84a3-9e75-4174-8370-104682bc366f is SUCCESS on commit 896a122. Runtime evidence shows durableJobsEnabled=true, configuredTenants=1, runtime role tms_app, and a durable_job.batch_completed observation with claimed=0/completed=0/failed=0. PR #63 now establishes the source-controlled business flow and idempotency contract; runtime proof remains open until migration 0033 is applied and a real freight status transition is observed end-to-end.

tms-backup-worker latest deployment:
- Deployment: 71784d43-8d6b-49a5-8838-03303438beda
- State: SUCCESS
- Commit: ce9781fd184082ae3a2a89ba6ada1bdc80068940
- Runtime backup execution is not independently proven from deployment logs; deploy log inspection returned no backup execution record.

## Neon

Current project:
- tms — PRESERVE
- legacy nexora-tms project — absent from current project inventory

Current restore/DR branches are retained pending formal reconciliation. No production mutation was performed during this update.

Live main read-only evidence previously observed:
- tenants=1
- tenant_memberships=1
- freights=0
- outbox_events=0
- durable_jobs=0
- migration count observed=31

RLS structure and tms_app privilege evidence are verified at implementation/integration level; cross-tenant production E4 remains open (BLK-RLS-E4-01).

## Environment parity

Current application deployment SHA: `f9bb9d4225a777f4c2bc899c4008e2e0b2dd4d91`. A later CI-only commit `cd4b7f11ad683d96f607e8900cd2aca8d56a7aec` adds the guarded non-production workflow.

Live Neon read-only comparison:
- `main` (`br-lingering-shadow-act0vvi9`): PostgreSQL 17.11, 21 public tables, `schema_migrations` present, 31 migrations.
- `development` (`br-withered-salad-acjhyf6y`): PostgreSQL 17.11, 11 public tables, `schema_migrations` absent.
- `staging` (`br-bitter-brook-acpux97x`): PostgreSQL 17.11, 11 public tables, `schema_migrations` absent.
- Schema diff against production confirms development/staging are materially behind canonical production.

Classification: **BLK-ENV-PARITY-01 OPEN**. Development and staging are legacy/divergent schemas and are not proven synchronized application environments.

A guarded workflow was added at `.github/workflows/database-migrate-nonprod.yml` in commit `cd4b7f11...`. It accepts only `development` or `staging`, reads `NEON_DATABASE_URL` from the selected GitHub Environment, and runs the canonical database migration command with the existing-schema baseline guard. The workflow has **not** been executed: the available GitHub connector cannot configure/read GitHub Environment secrets or dispatch this workflow. No production secret was reused.

## CI/CD

Canonical CI workflow is structurally present with:
- Node 24.20.0
- pnpm 11.24.0
- frozen lockfile
- migrations
- runtime-role validation
- RLS runtime integration
- IAM runtime resolver integration
- Durable Jobs PostgreSQL integration
- format, lint, typecheck, tests and build

For the previously audited application HEADs:
- `f9bb9d4225a777f4c2bc899c4008e2e0b2dd4d91`: GitHub Actions CI run `35554413967` / quality job `106195137392` completed SUCCESS, including migrations, runtime-role validation, non-bypass RLS integration, IAM runtime resolver integration, Durable Jobs PostgreSQL integration, format/lint/typecheck/tests/build.
- `cd4b7f11ad683d96f607e8900cd2aca8d56a7aec`: CI-only follow-up adding guarded non-production migration workflow.
- Production Vercel deployments are READY on f9bb9d4.
- tms-worker has no successful current-head deployment; its last successful runtime remains e1db84a3 on 896a122.
- Cross-tenant production RLS E4 remains a separate runtime gate.

## Auth0

Verified source-controlled desired Post-Login Action:
- Action ID: 71b2ff45-77a6-408e-a881-002ab82b9d9e
- Trigger: post-login/v3
- Tenant claim: https://tms-platform.io/claims/tenant_id
- Source reads event.user.app_metadata.tenant_id
- Prior deployment evidence: GitHub Actions run 35475091311, success

Environment contract documentation includes the canonical Auth0 domain/issuer/JWKS variables in root and Web .env.example files. No secrets or populated credentials were added.

### AUTH0-REAL-TOKEN-01 — OPEN

Still required:
1. newly issued real TMS Access Token
2. issuer
3. audience
4. RS256 signature/JWKS
5. expiry/time validity
6. namespaced tenant claim
7. production API acceptance
8. tenant authorization
9. RBAC behavior
10. rejection behavior

Previously exposed token material must not be reused or documented.

## DR / Restore Verification

### Isolated restore-proof branch

Target branch: `stage10.11-restore-proof-safe` (`br-misty-smoke-acwzvipt`).

Authorized corrective migration was applied **only to this isolated branch**, never to production/main.

Before correction:
- `schema_migrations`: 28
- latest migration: `0028_durable_jobs.sql`

Applied canonical migrations:
- `0029_runtime_app_role.sql`
- `0030_compliance_assignment_freight_invariant.sql`
- `0031_finance_relationship_invariants.sql`

Post-correction evidence:
- `schema_migrations`: 31
- latest: `0031_finance_relationship_invariants.sql`
- all three recorded checksums match the canonical migration files
- `tms_app`: LOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOINHERIT
- compliance/GR/finance/trip relationship constraints exist and are validated
- `durable_jobs`, `freights`, `outbox_events`, `financial_entries`, `freight_assignments`, and `trips` have RLS enabled and FORCE RLS
- schema comparison against production now shows only expected Neon Auth ownership/ACL differences; the previous missing 0030/0031 functional schema differences are gone

Classification:
- **DR schema parity on isolated restore-proof branch: PASS**
- **Current encrypted-backup restore execution: OPEN**
- **DR-RESTORE-E4 remains OPEN** until the current encrypted backup is independently restored/verified from the backup artifact itself. The present branch proves canonical schema reconciliation, not the full backup-runtime restore chain.

## Operational status

| Gate | Status | Evidence |
|---|---|---|
| Canonical GitHub repository | PASS | E2 |
| Vercel project cleanup | PASS | E2 |
| Railway legacy backup cleanup | PASS | E2 |
| Neon legacy project cleanup | PASS | E2 |
| tms-web current-main production | PASS | READY deployment dpl_6tja... on f9bb9d4 |
| tms-core-api health | PASS | E4 runtime HTTP 200 |
| tms-core-api current-main production parity | PASS | READY deployment dpl_HHjz... on f9bb9d4 |
| Auth0 Action source/deployment evidence | PASS | E3/E4 historical evidence |
| Auth0 real-token E2E | OPEN/BLOCKER | AUTH0-REAL-TOKEN-01 |
| Worker runtime durable jobs | PASS | e1db84a3, durableJobsEnabled=true |
| Worker business event → durable job contract | IMPLEMENTED / RUNTIME OPEN | PR #63 source path; runtime E3/E4 not yet proven |
| CI exact-current-HEAD execution | PASS | GitHub Actions run 35554413967 / quality job 106195137392 |
| Cross-tenant RLS E4 | OPEN/BLOCKER | BLK-RLS-E4-01 |
| DR schema parity on isolated restore-proof branch | PASS | 31 migrations + validated 0030/0031 constraints |
| Current encrypted-backup restore E4 | OPEN/BLOCKER | DR-RESTORE-E4 |
| Backup worker deployment | PASS | 71784d43 SUCCESS |
| Backup worker runtime execution | OPEN | No execution record in inspected deployment logs |
| Environment parity development/staging | OPEN/BLOCKER | BLK-ENV-PARITY-01 |

## Worker / Outbox gate

PR #63 establishes the source-controlled execution contract targeted by `BLK-WORKER-01`:

`freight.status_changed → outbox_events → durable_jobs → freight-status-changed.handler.ts → audit/telemetry`.

Implemented source path:
1. `FreightService.updateStatus()` passes the status transition through the freight repository.
2. The freight transaction writes `freight.status_changed` to `outbox_events` atomically with the business change.
3. The worker consumes the outbox event and creates `freight.status_changed` in `durable_jobs`, keyed idempotently by the outbox event ID.
4. `freight-status-changed.handler.ts` validates tenant/freight/status and writes an idempotent audit completion record.
5. Worker telemetry records the handler event and durable-job lifecycle/status/errorCode.

Classification: **IMPLEMENTED / NOT RUNTIME-PROVEN**. Migration `0033_durable_job_idempotency.sql` and a real Neon/Railway execution are still required before E3/E4 promotion.

## Required next execution order

1. Complete production IAM E2E with a newly issued real TMS Access Token without exposing the token.
2. Validate tenant/RBAC/RLS rejection and isolation paths.
3. Resolve the worker business event → durable-job contract; do not invent a job type or payload without source-of-truth evidence.
4. Execute isolated restore verification against the current encrypted backup artifact.
5. Resolve development/staging environment parity through their guarded migration workflow.
6. Run final regression and update the evidence ledger/SSOT.
7. Only then evaluate Final DoD.

## Safety rules

- Never expose secrets, client secrets, database URLs, signing keys, or access tokens.
- Never reuse an old exposed Access Token.
- Never treat a preview/audit deployment as production proof.
- Never claim CI workflow execution for a SHA without matching workflow evidence.
- Never mutate production data merely to manufacture evidence.
- Preserve historical audit records and distinguish them from current state.
- Do not delete Neon restore/DR branches without branch-level evidence and explicit authorization.
