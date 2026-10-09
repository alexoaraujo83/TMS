# TMS — Release Control Snapshot — 2026-10-09

> Current temporal snapshot. Earlier dated release-control documents remain historical and must not be edited to represent this run.
>
> Repository: `alexoaraujo83/TMS`
> Branch: `main`
> Auth0 evidence run source commit: `e005d46dba554dd41e94347107ba04425e7fbae1`
> Status: **E2 IN PROGRESS / FINAL GATE OPEN**

## 1. Gate matrix

| Gate | State | Current evidence |
|---|---|---|
| BAK-01 | **E4 CONFIRMED / PASS** | Real scheduled 2026-10-08 backup persisted its manifest; artifact, checksum, integrity and retention corroborated in Production Neon. |
| WORK-02 / WORK-03 | **E4 PASS** | Previously documented Production worker/outbox evidence remains the current checkpoint. |
| API-06 | **E4 PASS** | Previously documented Production authorized/unauthorized diagnostic pair remains the current checkpoint. |
| DB-04 | **E4 CONFIRMED / PASS** | Restricted Production `tms_app` role; no RLS bypass/superuser; tenant read isolation; cross-tenant writes rejected; rollback/no-persistence. |
| AUTH-01 | **OPEN / P0 — PARTIAL PROGRESS** | Live read-only export succeeded; Action source matches, deployed=true, post-login v3 and one binding confirmed. URI/grant security findings and remaining closure evidence require review. |
| DR-01 | **OPEN / E4 PENDING** | Requires independently current restore/RTO evidence. |
| ENV-01 | **BLOCKED / PENDING** | Full environment parity/ownership decision remains open. |
| ENV-02 | **PARTIAL / PENDING** | Variable presence verified; complete non-secret value parity not proven. |
| CI-02 | **OPEN / POLICY PENDING** | Branch-protection/ruleset enforcement not independently proven. |
| FINAL-01 | **OPEN / BLOCKED** | Mandatory P0/P1 and formal policy gates are not all closed. |

## 2. Auth0 live export evidence — 2026-10-09

- Run: https://github.com/alexoaraujo83/TMS/actions/runs/37877327257
- Job: `Export Auth0 Production configuration (read-only)` — **success**.
- Artifact: [`auth0-production-export-evidence`](https://github.com/alexoaraujo83/TMS/actions/runs/37877327257/artifacts/11593121216), ID `11593121216`, 9,137 bytes, SHA-256 `f21319c710e410c17be086dfc39754ced6ad5690e0e0e40386040ab405ec963c`, expires 2026-10-16.
- Comparator result: `status=match`; Action `TMS — Tenant Claim`; deployed `true`; trigger `post-login v3`; one matching binding; source code matches `infra/auth0/actions/post-login.js`.
- The workflow explicitly asserts no Auth0 import, update, create or delete occurred.

### Follow-up findings

1. TMS Web callback URLs and allowed-origin/web-origin/logout URI sets have localhost vs loopback inconsistencies. Reconcile against the intended environment contract before any live change.
2. API Explorer has a client grant to the Auth0 Management API with extensive administrative scopes. Confirm ownership, necessity and least privilege.
3. TMS Web export reports `is_token_endpoint_ip_header_trusted=true`; verify intended use.
4. Binding order, Action ID/last-modified metadata, exact Connection enablement, direct user `app_metadata.tenant_id`/membership, negative authorization tests and end-to-end smoke evidence remain open.

**Decision:** this is a narrow PASS for Action source/deployed state/trigger/binding count, not a full tenant-security certification. AUTH-01 remains OPEN/P0.

## 3. Current E2 decision

**E2 remains IN PROGRESS / NOT CLOSED.**

No Auth0 configuration was mutated by the read-only export. Continue with the remaining AUTH-01 closure evidence and the independent DR-01, ENV-01/ENV-02 and CI-02 gates. Do not declare Production complete until FINAL-01's required evidence is reconciled.
