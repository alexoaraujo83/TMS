# TMS — Single Source of Truth (SSOT) Operational State

Evidence-ledger snapshot. This document records verified state only; it is not a substitute for deployment/runtime evidence.

## Canonical source

- Repository: alexoaraujo83/TMS
- Canonical branch: main
- Audited GitHub HEAD before this SSOT reconciliation: 675fbaaf11081c721b0a6d9ad0beebca14056353
- HEAD message: fix(web): harden Auth0 SDK BFF flow
- GitHub commit: verified/signed
- SSOT reconciliation branch: audit/chat-09-current-state-2026-09-20

## Current infrastructure inventory

### Vercel

Only the canonical projects remain:

| Project | State | Evidence |
|---|---|---|
| tms-web | PRESERVE | Current project inventory |
| tms-core-api | PRESERVE | Current project inventory |

Previously authorized cleanup targets are no longer present:
- transportadora — REMOVED
- alexoaraujo83-agenciador — REMOVED
- agenciador — REMOVED
- nextjs-boilerplate — REMOVED

Current latest READY deployments observed:
- tms-web: dpl_CxG37FZfhL2rTJasWquwqsFuWkLm, commit c535edcdfbd00ffa9da1a9f070f349f41456bf96, branch audit/chat-08-operational-routing-2026-09-20
- tms-core-api: dpl_rJQN2rHvAnACC51RJhbg27TVUkM1, commit c535edcdfbd00ffa9da1a9f070f349f41456bf96, branch audit/chat-08-operational-routing-2026-09-20

Important parity finding:
- The latest READY deployments are not the current main HEAD.
- The latest production-target deployments observed for both projects are still on commit d5abedff8c5e986578c5abd1c9b0db71385f6e7a.
- Therefore Vercel production freshness against current main is NOT yet E4-proven.
- Do not treat the READY preview/audit deployment as proof that production runs 675fbaaf.

### Railway

Current project topology:
- tms-worker — PRESERVE
- tms-backup-worker — PRESERVE
- legacy backup-worker — REMOVED

A current GitHub code search shows no operational code reference to the removed legacy service. Historical audit documents still mention it; those records are retained as evidence and must not be rewritten as if they were current state.

### Neon

Current Neon project:
- tms — PRESERVE

The previously authorized nexora-tms project is absent from the current Neon project inventory.

Current tms branches observed:
- main
- development
- staging
- iam-validation-20260918
- mcp-migration-2026-09-13T15-16-12
- stage10.11-restore-proof-safe
- tms-dr-restore-20260916
- stage10.11-restore-proof-2026-09-14 (1)
- tms-canonical-baseline-test

Restore/DR branches are retained pending formal evidence reconciliation; no blind deletion is authorized by this document.

## CI/CD current state

The canonical CI workflow is structurally present and includes:
- push/PR gates on main
- Node 24.20.0
- pnpm 11.24.0
- frozen lockfile installation
- database migrations
- runtime-role validation
- RLS runtime integration
- IAM runtime resolver integration
- Durable Jobs PostgreSQL integration
- format, lint, typecheck, tests and build

The database migration workflow is production-scoped and uses GitHub Environment `production` with secret `NEON_DATABASE_URL`.

For commit 675fbaaf11081c721b0a6d9ad0beebca14056353, the current GitHub connector returned no associated pull-request-triggered workflow run. This is not evidence of failure; it means CI execution for that exact SHA is not currently proven by the inspected connector result.

## Auth0 state

The deployed/bound Post-Login Action remains the verified tenant-claim implementation:
- Action ID: 71b2ff45-77a6-408e-a881-002ab82b9d9e
- Trigger: post-login/v3
- Tenant claim: https://tms-platform.io/claims/tenant_id
- Action reads `event.user.app_metadata.tenant_id`
- Missing tenant_id is denied
- Namespaced tenant claim is set for Access Token and ID Token
- Prior GitHub Actions deployment evidence: run 35475091311, conclusion success

### Current blocker: AUTH0-REAL-TOKEN-01

The remaining IAM gate is a newly issued real TMS Access Token exercised end-to-end.

Required evidence:
1. issuer
2. audience
3. RS256 signature/JWKS
4. expiry/time validity
5. namespaced tenant claim
6. production API authentication acceptance
7. tenant authorization
8. RBAC behavior
9. rejection behavior for missing/invalid tenant context

Previously exposed token material must not be reused or documented.

## Operational status

| Gate | Status | Evidence level |
|---|---|---|
| GitHub canonical repository | PASS | E2 |
| Vercel project cleanup | PASS | E2 |
| Railway legacy backup service cleanup | PASS | E2 |
| Neon legacy project cleanup | PASS | E2 |
| Vercel latest READY deployment | PASS | E3 |
| Vercel production parity with current main | OPEN | E2/E3 pending |
| Railway tms-worker | PRESERVE | E3 previously verified |
| Railway tms-backup-worker | PRESERVE | E3 previously verified |
| Neon canonical project/branches | PASS | E3 |
| Auth0 Action deployment/binding | PASS | E3/E4 |
| Auth0 real-token E2E | OPEN/BLOCKER | E0/E1 until new evidence |

## Required next execution order

1. Reconcile Vercel production deployment to the intended canonical main SHA.
2. Verify production deployment state and runtime endpoints.
3. Re-run/obtain CI evidence for the exact promoted SHA.
4. Validate production environment parity without exposing secrets.
5. Execute Auth0 real-token E4 validation.
6. Validate tenant/RBAC/RLS rejection and isolation paths.
7. Execute worker/outbox runtime validation.
8. Execute backup/restore verification.
9. Run final regression and update the evidence ledger.

## Safety rules

- Do not expose secrets, client secrets, database URLs, signing keys, or access tokens.
- Do not reuse an old exposed Access Token.
- Do not delete Neon restore/DR branches without branch-level evidence and explicit authorization.
- Do not treat a preview/audit deployment as production proof.
- Do not claim CI success for a SHA without a matching run or equivalent execution evidence.
- Preserve historical audit documents; correct current SSOT separately.
