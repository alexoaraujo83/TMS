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
| Vercel | tms-web | SUCCESS | E3 | Production Git integration check passed for current commit |
| Vercel | tms-core-api | READY | E3 | Production deployment dpl_7WgthWPqiRWdsKhFU7jyf2QjFq4n |
| Vercel | tms-core-api /health | HTTP 200 | E4 | Real production runtime request observed |
| Vercel | tms-core-api /ready | not externally validated | E0 | Protected by Vercel Authentication/SSO in current access path |
| Vercel | API runtime startup | successful | E4 | DatabaseModule and all application modules initialized; Nest application started |
| Railway | tms-worker | SUCCESS / main | E3 | Deployment status only; business-event completeness remains separate |
| Railway | tms-backup-worker | SUCCESS / main | E3 | Backup/restore verification remains separate |
| Railway | backup-worker (legacy) | no current deployment observed | E1 | Do not delete without dependency analysis |
| Neon | main branch | available | E3 | Inspected migration count = 31 |
| Code | database schema version | 31 | E1 | Matches inspected Neon migration count |

## Resolved blocker

### VERCEL-API-PROD-01 — RESOLVED

The API production deployment was previously behind GitHub main. The current production deployment is now on main commit f884b973343e6c00c582cbb2272e1faa33ba4dac and is READY.

The same commit has successful reported status checks for:
- Vercel – tms-web
- Vercel – tms-core-api
- tms-backup – tms-worker
- tms-backup – tms-backup-worker

## Current blocker

### VERCEL-API-RUNTIME-DB-01

The application exposes /ready, which executes a PostgreSQL query for current_user and requires the runtime role to be exactly tms_app. The route is mapped in the production application, but direct access through the current Vercel deployment URL is intercepted by Vercel Authentication/SSO with HTTP 302.

A temporary Vercel shareable URL was generated through the Vercel integration, but fetching it also returned HTTP 302 to Vercel SSO. Therefore the shareable-link path did not provide independent runtime access to /ready.

Runtime logs prove application startup and DatabaseModule initialization, but they do not prove:
- the deployed runtime can successfully execute the /ready database query;
- the runtime PostgreSQL user is tms_app;
- the database connection is operational from the Vercel function.

No code change has been made to expose database identity or bypass the gate unsafely.

## Required validation sequence

1. Keep the current production deployment f884b973... as the API baseline.
2. Obtain an authenticated/programmatic path that legitimately bypasses Vercel Deployment Protection, or an equivalent server-side evidence path.
3. Request /ready through that path.
4. Confirm HTTP 200 and the application response status=ready.
5. Confirm the route's tms_app runtime-role assertion passes.
6. Only then close VERCEL-API-RUNTIME-DB-01.
7. Then validate Auth0 Post-Login Action publication and linkage.
8. Only after Action publication/linkage and API runtime readiness, validate a real TMS Access Token against the production API.
9. Validate issuer, audience, RS256 signature, expiry, namespaced tenant claim, tenant authorization and RBAC behavior.

## Safety rules

- Do not create artificial/no-op commits solely to trigger infrastructure.
- Do not reset, delete, or recreate Neon branches/databases to force synchronization.
- Do not apply migrations merely because GitHub and Neon have different identifiers; reconcile migration state first.
- Do not delete the legacy Railway backup-worker until dependency/use analysis proves it is obsolete.
- Do not claim E2/E3/E4 evidence from configuration files alone.
- Do not expose secrets, client secrets, database URLs, signing keys, or tokens in this document.
- Do not modify /ready to return or expose the database role merely to pass the gate.
- Do not validate the production Access Token before the API runtime database gate is closed.

## Evidence status

- GitHub → Vercel Web: PASS for current commit status.
- GitHub → Vercel Core API production deployment: PASS; READY on f884b973.
- API production /health: PASS; HTTP 200.
- API production application startup: PASS; runtime logs show successful Nest startup and route mapping.
- API production database readiness: BLOCKED; /ready cannot currently be independently exercised because Vercel Authentication/SSO intercepts the request.
- Neon schema count: observed at 31; this is not proof of Vercel runtime identity.
- Auth0 real-token gate: BLOCKED by VERCEL-API-RUNTIME-DB-01.

## Next gate

GATE: VERCEL CORE API PRODUCTION → RUNTIME DATABASE READINESS

No Auth0 real-token approval is granted until this gate is evidenced.
