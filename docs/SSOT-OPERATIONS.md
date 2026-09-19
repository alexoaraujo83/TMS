# TMS — Single Source of Truth (SSOT) Operational State

Evidence-ledger snapshot. This document records verified state only; it is not a substitute for deployment/runtime evidence.

## Canonical source

- Repository: alexoaraujo83/TMS
- Canonical branch: main
- Latest verified API production commit: f884b973343e6c00c582cbb2272e1faa33ba4dac
- Latest API production deployment: dpl_7WgthWPqiRWdsKhFU7jyf2QjFq4n
- API production deployment state: READY
- API deployment target: production
- API deployment region: iad1

## Cross-system reconciliation

| System | Component | Observed state | Evidence level | Notes |
|---|---|---|---|---|
| GitHub | TMS main | f884b973343e6c00c582cbb2272e1faa33ba4dac | E2 | Includes API lint/typecheck workspace-build correction |
| GitHub | commit status | all reported checks success | E3 | Vercel Web, Vercel Core API, Railway Worker and Railway Backup Worker |
| Vercel | tms-web | SUCCESS | E3 | Production Git integration check passed for current main commit |
| Vercel | tms-core-api | READY | E3 | Production deployment dpl_7WgthWPqiRWdsKhFU7jyf2QjFq4n |
| Vercel | tms-core-api /health | HTTP 200 | E4 | Real production runtime request observed |
| Vercel | tms-core-api /ready | HTTP 200 | E4 | Temporary authenticated/shareable access path returned status=ready |
| Vercel | API runtime DB role assertion | PASS | E4 | /ready only returns 200 after current_user = tms_app |
| Vercel | API runtime startup | successful | E4 | DatabaseModule and application modules initialized; Nest application started |
| Railway | tms-worker | SUCCESS / main | E3 | Deployment status only; business-event completeness remains separate |
| Railway | tms-backup-worker | SUCCESS / main | E3 | Backup/restore verification remains separate |
| Railway | backup-worker (legacy) | no current deployment observed | E1 | Do not delete without dependency analysis |
| Neon | main branch | available | E3 | Inspected migration count = 31 |
| Code | database schema version | 31 | E1 | Matches inspected Neon migration count |
| Auth0 | Post-Login Action | deployed and bound | E3/E4 | Action ID 71b2ff45-77a6-408e-a881-002ab82b9d9e; verified by GitHub Actions run 35475091311 |
| Auth0 | tenant claim | verified in deployed Action | E3 | https://tms-platform.io/claims/tenant_id |
| GitHub | Auth0 automation | verified on auth0-tenant-claim-action | E2/E3 | Run 35475091311 succeeded; workflow restored to manual dispatch after execution |

## Resolved blockers

### VERCEL-API-PROD-01 — RESOLVED

The API production deployment is on GitHub main commit f884b973343e6c00c582cbb2272e1faa33ba4dac and is READY.

The same commit has successful reported status checks for:
- Vercel – tms-web
- Vercel – tms-core-api
- tms-backup – tms-worker
- tms-backup – tms-backup-worker

### VERCEL-API-RUNTIME-DB-01 — RESOLVED

The production /ready endpoint was exercised through a legitimate temporary Vercel authenticated/shareable access path and returned:

- HTTP 200
- {"status":"ready","service":"tms-api"}

The route implementation performs a PostgreSQL query for current_user and rejects the request unless the runtime role is exactly tms_app. Therefore the successful response is operational evidence that the deployed Vercel runtime reached PostgreSQL and passed the tms_app assertion.

No code change was made to expose the database role or weaken the readiness gate.

### AUTH0-POST-LOGIN-TENANT-01 — RESOLVED

The existing Auth0 Action was reconciled rather than duplicated.

Verified external state:
- Tenant: tms-platform.us.auth0.com
- Action: TMS — Tenant ID Access Token
- Action ID: 71b2ff45-77a6-408e-a881-002ab82b9d9e
- Trigger: post-login/v3
- Status after build: built
- Deployment: verified
- Post-Login binding: verified
- Tenant claim: https://tms-platform.io/claims/tenant_id

The deployed Action reads event.user.app_metadata.tenant_id, denies login when the tenant_id is absent, and sets the namespaced tenant claim in both the access token and ID token.

GitHub Actions evidence:
- Workflow run: 35475091311
- Commit: 38917899a5fed64cc93281628809bd974386474a
- Job: Deploy and bind TMS Post Login Action
- Conclusion: success
- Log output verified deployed=true and bound=true.

Auth0 documents that Post-Login Actions can set custom Access Token claims with api.accessToken.setCustomClaim() and recommends namespaced custom claims. citeturn8search0turn8search1

## Current blocker

### AUTH0-REAL-TOKEN-01

The remaining gate is production real Access Token validation.

The Action publication and binding gate is closed, and the API production database-readiness gate is closed. The next validation must use a newly issued real TMS Access Token after the deployed Action is active.

Required checks:
- issuer
- audience
- RS256 signature and JWKS key
- expiry/time validity
- presence and value shape of the namespaced tenant claim
- API authentication acceptance
- tenant authorization
- RBAC/permission behavior
- rejection behavior for missing/invalid tenant context

Previously exposed token material must not be reused or copied into documentation.

## Required validation sequence

1. Keep the current production API deployment f884b973... as the runtime baseline.
2. Keep the verified Auth0 Action 71b2ff45-77a6-408e-a881-002ab82b9d9e bound to Post Login.
3. Obtain a newly issued real TMS Access Token through the configured OIDC flow.
4. Validate the JWT locally/independently: issuer, audience, RS256 signature, JWKS, expiry and tenant claim.
5. Send the real token to the production TMS API.
6. Confirm the API accepts a valid token and derives tenant context correctly.
7. Confirm tenant isolation and RBAC behavior.
8. Record E4 evidence and close AUTH0-REAL-TOKEN-01.
9. Only then proceed to broader IAM/RBAC/RLS regression validation.

## Safety rules

- Do not create artificial/no-op commits solely to trigger infrastructure.
- Do not reset, delete, or recreate Neon branches/databases to force synchronization.
- Do not apply migrations merely because GitHub and Neon have different identifiers; reconcile migration state first.
- Do not delete the legacy Railway backup-worker until dependency/use analysis proves it is obsolete.
- Do not claim E2/E3/E4 evidence from configuration files alone.
- Do not expose secrets, client secrets, database URLs, signing keys, or tokens in this document.
- Do not modify /ready to return or expose the database role merely to pass the gate.
- Do not reuse an old exposed Access Token for production validation.
- Do not approve Auth0 real-token validation from configuration alone; require a newly issued token and runtime evidence.

## Evidence status

- GitHub → Vercel Web: PASS for current main commit status.
- GitHub → Vercel Core API production deployment: PASS; READY on f884b973.
- API production /health: PASS; HTTP 200.
- API production /ready: PASS; HTTP 200 with status=ready.
- API production database readiness: PASS; tms_app assertion passed inside /ready.
- Auth0 Post-Login Action deployment: PASS; action 71b2ff45-77a6-408e-a881-002ab82b9d9e.
- Auth0 Post-Login binding: PASS; binding verified by automation.
- Auth0 tenant claim implementation: PASS; namespaced claim configured for access and ID tokens.
- Auth0 real-token gate: OPEN/BLOCKER until a newly issued real production token is validated end-to-end.
- Neon schema count: observed at 31; this is not proof of Vercel runtime identity beyond the separate /ready evidence.

## Next gate

GATE: AUTH0 → REAL TMS ACCESS TOKEN → PRODUCTION API

No final IAM/Auth0 approval is granted until the real-token E4 path is evidenced.
