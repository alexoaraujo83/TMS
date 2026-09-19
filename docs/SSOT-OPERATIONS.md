# TMS — Single Source of Truth (SSOT) Operational State

Evidence-ledger snapshot. This document records verified state only; it is not a substitute for deployment/runtime evidence.

## Canonical source

- Repository: alexoaraujo83/TMS
- Canonical branch: main
- Current main commit at audit: 5b32eb4
- Audit branch used for the Vercel monorepo correction: audit/ssot-2026-09-19
- Audit correction commit: bf5d1215d59d21f79c02b7d4c5ec70d2e606b543

## Cross-system reconciliation

| System | Component | Observed state | Evidence level | Notes |
|---|---|---|---|---|
| GitHub | TMS main | 5b32eb4 | E1 | Canonical source |
| Vercel | tms-web production | READY on current main | E3 | Web is current |
| Vercel | tms-core-api audit deployment | READY on bf5d1215 | E3 | Monorepo dependency build correction verified |
| Vercel | tms-core-api production | READY on ccb1190 | E3 | 15 commits behind current main at audit time |
| Railway | tms-worker | SUCCESS / main | E3 | Do not infer business-event completeness from deployment state |
| Railway | tms-backup-worker | SUCCESS / main | E3 | Backup verification remains a separate operational gate |
| Railway | backup-worker (legacy) | no current deployment observed | E1 | Do not delete without dependency analysis |
| Neon | main branch | available | E3 | Schema inspection reports 31 migrations |
| Code | database schema version | 31 | E1 | Matches inspected Neon migration count |

## Current blocker

### VERCEL-API-PROD-01

The production deployment of tms-core-api was observed at commit ccb1190a01acef3bbc194e133289be88ca0af00a, while GitHub main is 5b32eb4.

GitHub comparison at audit time:

- ahead: 15 commits
- behind: 0 commits
- merge base: ccb1190a01acef3bbc194e133289be88ca0af00a

Therefore production API synchronization is not considered complete.

## Required validation sequence

1. Deploy current GitHub main to tms-core-api production.
2. Verify deployment state is READY.
3. Verify /health returns HTTP 200.
4. Verify /ready with the required authentication/access path.
5. Verify runtime database identity is tms_app.
6. Verify database access succeeds from the deployed runtime.
7. Only after the API runtime gate is closed, validate the Auth0 Post-Login Action publication/linkage.
8. Only after Action publication/linkage, validate a real TMS Access Token against the production API.
9. Validate issuer, audience, signature, expiry, tenant claim and authorization behavior.

## Safety rules

- Do not create artificial/no-op commits solely to trigger infrastructure.
- Do not reset, delete, or recreate Neon branches/databases to force synchronization.
- Do not apply migrations merely because GitHub and Neon have different identifiers; reconcile migration state first.
- Do not delete the legacy Railway backup-worker until dependency/use analysis proves it is obsolete.
- Do not claim E2/E3/E4 evidence from configuration files alone.
- Do not expose secrets, client secrets, database URLs, signing keys, or tokens in this document.
- Do not validate the production Access Token before the API runtime gate is closed.

## Evidence status

- GitHub → Vercel Web: synchronized at audit snapshot.
- GitHub → Railway Worker/Backup Worker: deployment source observed as main.
- GitHub → Vercel Core API production: BLOCKED — production behind main.
- Neon schema parity: migration count observed at 31; runtime identity from the Vercel production API still requires independent verification.
- Auth0 real-token gate: BLOCKED by API production synchronization/runtime validation.

## Next gate

GATE: VERCEL CORE API PRODUCTION → RUNTIME DATABASE READINESS

No Auth0 real-token approval is granted until this gate is evidenced.
