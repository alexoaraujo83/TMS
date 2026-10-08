# TMS — Release Control Snapshot — 2026-10-08

> **Purpose:** current evidence snapshot. This document supersedes the 2026-10-07 control snapshot for current temporal status; historical manifests remain immutable.
>
> **Repository:** `alexoaraujo83/TMS`
> **Control branch:** `main`
> **Current main HEAD at reconciliation start:** `e7e35824eae7fdb6fd3d68898f861f37fcac922b`
> **Status:** E2 IN PROGRESS / FINAL GATE OPEN

## 1. Current gate matrix

| Gate | State | Current evidence |
|---|---|---|
| BAK-01 | **E4 CONFIRMED / PASS** | Real scheduled 2026-10-08 cycle persisted a verified manifest; artifact, checksum, integrity and retention corroborated directly in Production Neon. |
| WORK-02 / WORK-03 | **E4 PASS** | Production worker/outbox flow and readiness evidence remain valid. |
| API-06 | **E4 PASS** | Production authorization diagnostic negative/positive pair remains the current documented result. |
| DB-04 | **E4 CONFIRMED / PASS** | Production restricted `tms_app` session: `rolbypassrls=false`, `rolsuper=false`; own-tenant SELECT visible; cross-tenant SELECT invisible; cross-tenant INSERT/UPDATE rejected with SQLSTATE 42501; savepoint rollback/no-persistence verified. |
| AUTH-01 | **OPEN / P0** | Live Auth0 Action/version/binding/Connection/export reconciliation remains unproven. |
| DR-01 | **OPEN / E4 PENDING** | Restore control path exists, but current tracker requires independently current restore/RTO evidence before closure. |
| ENV-01 | **BLOCKED** | Full environment parity/ownership decision remains open. |
| ENV-02 | **PARTIAL** | Variable presence is verified; complete non-secret value parity is not. |
| CI-02 | **OPEN / POLICY PENDING** | Operational checks are green, but branch-protection/ruleset enforcement is not independently proven. |
| FINAL-01 | **OPEN / BLOCKED** | Mandatory P0/P1 and formal policy gates are not all closed. |

## 2. Backup evidence

The 2026-10-08 backup was produced by the normal scheduled cron path; no manual backup or artificial manifest insertion was used.

- Start: `20261008T020419Z`
- Object: `tms/postgres/20261008T020419Z/tms-20261008T020419Z.dump.enc`
- Size: **194,640 bytes**
- SHA-256: **db44a1ee109789601f0959307363fddf5c3da79f18943d6fa98ae06e4b737f47**
- PostgreSQL: **17.11**
- Public tables: **26**
- Migrations: **41**
- Manifest: `manifest_version=1`
- Persistence: `INSERT 0 1`, `manifest_persisted=true`, count **1**
- Backup status: **verified**
- Retention status: **verified**
- Production Neon corroboration: creation `2026-10-08T02:04:19Z`; recording `2026-10-08T02:05:10.321Z`; integrity and retention verified.

## 3. Historical-document rule

- `docs/releases/RELEASE-MANIFEST-2026-10-05.md` remains historical and is not edited.
- `docs/releases/RELEASE-CONTROL-2026-10-07.md` is superseded as the current temporal snapshot because its HEAD/evidence date is older.
- Current status is governed by `AUDIT-TRACKER.md`, `TMS-MASTER-AUDIT.md`, and this 2026-10-08 snapshot.

## 4. E2 decision

**E2 remains IN PROGRESS / NOT CLOSED.**

No gate is promoted to final production completion from documentation alone. The next closure work remains AUTH-01, DR-01, ENV-01/ENV-02 and CI-02, followed by FINAL-01 reconciliation. DB-04 is no longer a blocker.


## 5. DB-04 — Production RLS closure

The 2026-10-08 production runtime probe returned **6/6 checks PASS** in the restricted `tms_app` session.

- Runtime role: `tms_app`.
- Role security: `rolbypassrls=false`, `rolsuper=false`.
- Own-tenant SELECT: visible.
- Cross-tenant SELECT: invisible after switching tenant context.
- Cross-tenant INSERT: rejected by PostgreSQL/RLS with SQLSTATE 42501.
- Cross-tenant UPDATE / reassignment: rejected with SQLSTATE 42501.
- Savepoint + rollback: all mutation probes reverted; no persistence.

### Gate decision

**DB-04 — E4 CONFIRMED / PASS / FECHADO.**

No manual backup, artificial manifest, production restore, RLS change, grant change, role change or persistent production mutation was used for this evidence.

## 6. Remaining gates

- **AUTH-01:** OPEN / P0 — live Auth0 configuration/export reconciliation.
- **DR-01:** OPEN / E4 PENDING — current-artifact restore and measured RTO evidence.
- **ENV-01 / ENV-02:** operational evidence exists, formal parity closure pending.
- **CI-02:** operational checks green, formal branch-protection/policy closure pending.
- **FINAL-01:** OPEN until mandatory gates are closed or formally accepted with evidence.

**E2 remains IN PROGRESS / NOT CLOSED.**
