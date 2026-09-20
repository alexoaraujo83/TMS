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

- Latest observed production deployment: dpl_73x4yrEr5ZAaq3HKXWkcSRhAo9Bc
- State: READY
- Git ref: main
- Git SHA: ec67b9879f478eee1f2fd7d19f378113e2c41f61
- Target: production
- Region: iad1
- Production aliases include tms-web-chi.vercel.app
- Fresh runtime-log query for this deployment, last 24h, error/warning level, query AUTH0: no logs found.

### tms-core-api

- Latest observed READY production deployment: dpl_Gmv3sHbNDqdAXoJ7t4QL6dFfnkNN
- READY production SHA: ec67b9879f478eee1f2fd7d19f378113e2c41f61
- Therefore both canonical production services are currently deployed from the current main HEAD ec67b987.
- Production API /health: HTTP 200, response status=ok, service=tms-api.
- This documentation-only Web commit does not itself establish a need for an API redeploy; production API freshness remains separately tracked.

### Production parity classification

- Web current-main production parity: E4 for deployment state.
- API current-main production parity: OPEN; latest READY production is one documentation commit behind.
- Do not claim both production services run the same SHA.

## Railway

Current topology:
- tms-worker — PRESERVE
- tms-backup-worker — PRESERVE
- legacy backup-worker — REMOVED

tms-worker current-main deployment parity remains BLOCKED (BLK-WORKER-01): Railway's latest deployment is SKIPPED without a reusable build snapshot. Previous successful deployment evidence remains historical and is not promoted to current-main parity.

tms-backup-worker latest successful backup evidence remains verified:
- backup_status=verified
- retention_status=verified
- migration_count=31
- restore verification remains a separate open gate (BLK-DR-01).

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

For current main SHA ec67b9879f478eee1f2fd7d19f378113e2c41f61:
- GitHub Actions CI run 35534534067 (#984): SUCCESS.
- Event: push to main; workflow: .github/workflows/ci.yml.
- Therefore current-main CI execution is directly verified for this SHA.

## Auth0

Verified deployed/bound Post-Login Action:
- Action ID: 71b2ff45-77a6-408e-a881-002ab82b9d9e
- Trigger: post-login/v3
- Tenant claim: https://tms-platform.io/claims/tenant_id
- Source reads event.user.app_metadata.tenant_id
- Prior deployment evidence: GitHub Actions run 35475091311, success

Environment contract documentation now includes the canonical Auth0 domain/issuer/JWKS variables in root and Web .env.example files. No secrets or populated credentials were added.

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

## Operational status

| Gate | Status | Evidence |
|---|---|---|
| Canonical GitHub repository | PASS | E2 |
| Vercel project cleanup | PASS | E2 |
| Railway legacy backup cleanup | PASS | E2 |
| Neon legacy project cleanup | PASS | E2 |
| tms-web current-main production | PASS | E4 deployment evidence on ec67b987 |
| tms-core-api health | PASS | E4 runtime HTTP 200 |
| tms-core-api current-main production parity | PASS | READY production deployment dpl_Gmv3sHbNDqdAXoJ7t4QL6dFfnkNN runs ec67b987 |
| Auth0 Action deployment/binding | PASS | E3/E4 historical deployment evidence |
| Auth0 runtime AUTH0-log check on current Web deployment | PASS for inspected 24h window | E4 log observation |
| Auth0 real-token E2E | OPEN/BLOCKER | AUTH0-REAL-TOKEN-01 |
| Worker current-main parity | OPEN/BLOCKER | BLK-WORKER-01 |
| Cross-tenant RLS E4 | OPEN/BLOCKER | BLK-RLS-E4-01 |
| DR restore verification | OPEN/BLOCKER | BLK-DR-01 |

## Required next execution order

1. Obtain a newly issued real TMS Access Token and perform production IAM E2E without exposing the token.
2. Validate tenant/RBAC/RLS rejection and isolation paths.
3. Resolve worker current-main deployment parity using a supported Railway deployment path; do not create artificial trigger commits.
4. Execute isolated backup restore verification against the current encrypted backup.
5. Run final regression and update the evidence ledger/SSOT.
6. Only then evaluate Final DoD.

## Safety rules

- Never expose secrets, client secrets, database URLs, signing keys, or access tokens.
- Never reuse an old exposed Access Token.
- Never treat a preview/audit deployment as production proof.
- Never claim CI workflow execution for a SHA without matching workflow evidence.
- Never mutate production data merely to manufacture evidence.
- Preserve historical audit records and distinguish them from current state.
- Do not delete Neon restore/DR branches without branch-level evidence and explicit authorization.
