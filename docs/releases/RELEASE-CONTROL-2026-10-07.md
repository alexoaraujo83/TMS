# TMS — Release Control Snapshot — 2026-10-07

> **Purpose:** current evidence snapshot. This document does not overwrite the historical 2026-10-05 release manifest.
>
> **Repository:** `alexoaraujo83/TMS`
> **Control branch:** `main`
> **Current main HEAD:** `d37c90e84b952dcb9cfd4677fbbafa5542b35939`
> **Status:** E2 IN PROGRESS / FINAL GATE OPEN

## 1. Current production-control evidence

| Gate | State | Evidence |
|---|---|---|
| DB-04 / RLS | **CLOSED / PASS** | Production restricted-session matrix recorded in the TMS Master Audit: `tms_app`, non-bypass, own-tenant visibility, cross-tenant read/write denial and rollback/no-persistence. |
| Worker / Outbox | **CLOSED / PASS** | Production `freight.status_changed` → outbox → durable job → worker completion and readiness evidence. |
| Replay | **CLOSED / PASS** | Controlled replay evidence: 3 requests → 3 completed replay jobs, without duplicate business audit rows. |
| BAK-01 | **CLOSED / PASS** | Real scheduled manifests persisted in Production Neon; latest verified artifact is `20261006T020058Z`, 26 public tables, 41 migrations, checksum/integrity/retention verified. |
| DR Restore | **CLOSED / PASS** | Current encrypted artifact was restored in an isolated target and validated for checksum, bytes, decryption, PostgreSQL 17.11, 26 tables and 41 migrations. |
| API-06 | **CLOSED / PASS** | Production diagnostic authorization pair: unauthorized operator 403; authorized admin 200 with tenant context. |
| Transportes edit/save | **CLOSED / PASS** | Production PATCH returned 200 and field persistence was verified. |
| Transportes delete | **PASS** | Production UI deletion was confirmed successful. |
| Production runtime health | **PASS** | Current Vercel and Railway production health evidence is positive; no 24h Vercel runtime errors were observed in the cited checkpoint. |

## 2. Remaining gates

| Gate | State | Required closure |
|---|---|---|
| AUTH-01 | **OPEN / P0** | Independent read-only reconciliation of live Auth0 Action, version/publication, trigger binding, Connection, TMS Web association and `app_metadata.tenant_id` against the versioned contract. |
| ENV-01 / ENV-02 | **OPERATIONAL / PENDING PARITY CLOSURE** | Complete non-secret parity matrix across Vercel, Railway and Neon. |
| CI-02 | **OPERATIONAL / PENDING POLICY CLOSURE** | Independently prove desired branch-protection/ruleset enforcement. Current ruleset query was empty and direct branch-protection read is unavailable in the connected GitHub integration. |
| FINAL-01 | **OPEN** | Close AUTH-01 and formal ENV/CI policy gates, then perform final evidence/DoD reconciliation. |

## 3. Component deployment interpretation

The repository is a multi-component deployment. Git `main` HEAD must not be assumed to equal every effective production component SHA.

The latest combined status for the current control line reports success for:
- Vercel `tms-web`
- Vercel `tms-core-api`
- Railway `tms-worker`
- Railway `tms-backup-worker`

This confirms current deployment-check health, but component effective SHAs are retained only where independently identified in the audit evidence. No deployment was forced solely to equalize SHAs.

## 4. Backup / DR evidence policy

- Backup persistence evidence comes only from real scheduled cron cycles.
- No manual backup or artificial manifest insertion was used.
- No restore was performed against Production.
- The current-artifact DR evidence is isolated and read-only after restore validation.

## 5. Source-of-truth rule

For current status, use:
1. `docs/audit/TMS-MASTER-AUDIT.md`
2. `docs/audit/AUDIT-TRACKER.md`
3. This 2026-10-07 snapshot.

`docs/releases/RELEASE-MANIFEST-2026-10-05.md` remains historical and must not be used to infer current gate state where it conflicts with the current audit ledger.

---

**Conclusion:** the operational E4 gates documented as closed remain closed. **E2 is not closed** because AUTH-01 is still P0/open and ENV/CI policy reconciliation remains pending. **FINAL-01 remains open.**
