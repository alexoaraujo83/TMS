# TMS — Release Manifest — 2026-10-05

> **Purpose:** single, versioned release-control record that separates Git state from the effective production SHA of each independently promoted component.
>
> **Repository:** `alexoaraujo83/TMS`
> **Control branch:** `main`
> **Manifest status:** RECONCILED / EVIDENCE-BASED
> **Generated:** 2026-10-05 -03:00

## 1. Git control state

| Item | Value | Classification |
|---|---|---|
| Repository | `alexoaraujo83/TMS` | CANONICAL |
| Main HEAD | `1edf5c3af313ad9e32534187190db05279ed24d5` | CURRENT GIT HEAD |
| Release code reference | `e7e35824eae7fdb6fd3d68898f861f37fcac922b` | CURRENT PRODUCTION CODE SHA |
| Release-control merge | `1edf5c3af313ad9e32534187190db05279ed24d5` | DOCUMENTATION / CONTROL MERGE |

**Interpretation:** `main` advanced from the production code SHA because the release reconciliation documentation itself was merged after the e7 production promotion. Production component SHAs below are therefore tracked independently from Git `main` HEAD.

## 2. Effective production components

| Component | Platform | Deployment / evidence | Effective SHA | State |
|---|---|---|---|---|
| Web | Vercel / `tms-web` | `dpl_4jTG3GMNjQYPMTrPWfLM87hduK2h` | `e7e35824eae7fdb6fd3d68898f861f37fcac922b` | READY / PRODUCTION |
| API | Vercel / `tms-core-api` | `dpl_BTJuv3FqAR6snskJXb7QvGxMCyMz` | `e7e35824eae7fdb6fd3d68898f861f37fcac922b` | READY / PRODUCTION |
| Worker | Railway / `tms-worker` | latest current-SHA deployment was SKIPPED; last effective SUCCESS deployment `9d938334-b80c-4064-bd40-683620f950a2` | `6348d2926f0b0cac120ff9350bb77bc0fce0903d` | EFFECTIVE PREVIOUS SHA |
| Backup worker | Railway / `tms-backup` | deployment `21278249-58dc-4121-85de-d866a71a1003` | `e7e35824eae7fdb6fd3d68898f861f37fcac922b` | SUCCESS |

**Promotion rule:** a skipped Worker deployment is not treated as a production promotion. The effective Worker SHA remains the last successful production deployment until a new successful deployment is observed.

## 3. Database release state

| Item | Evidence | State |
|---|---|---|
| Neon project | `shiny-hall-34679912` | PRODUCTION REFERENCE |
| Database | `tms` | PRODUCTION REFERENCE |
| Branch | `br-lingering-shadow-act0vvi5v` | PRODUCTION REFERENCE |
| Live migration rows | 41 | VERIFIED |
| Auth0 migration 0036 | 1 row | VERIFIED |
| Legacy duplicate project-control 0036 | 0 rows | VERIFIED |
| Reconciliation migration 0040 | 1 row | VERIFIED |
| Schema-integrity migration 0041 | 1 row | VERIFIED |
| `schema_migrations` primary key | present | VERIFIED |
| Duplicate migration versions | 0 | VERIFIED |

**DB release classification:** DB-01 = **E4 OPERACIONAL — PASS**.

## 4. Authentication / authorization release references

- Auth0 tenant: `tms-platform`
- Issuer: `https://tms-platform.us.auth0.com/`
- Application: `TMS Web`
- Production audience: `urn:tms:api:production`
- Tenant claim namespace: `https://tms-platform.io/claims/tenant_id`
- AUTH-01: **E4 OPERACIONAL — PASS**
- API-01: **CI/RUNTIME MATRIX — PASS**
- API-02: **E4 OPERACIONAL — PASS**
- API-03: **REPETÍVEL / HANDLER IDEMPOTENTE**
- API-04: **CI — PASS**
- API-05: **DOCUMENTAÇÃO RECONCILIADA — PASS**
- API-06: **CORRIGIDO ESTRUTURALMENTE / E4 PENDENTE**

No secrets, access tokens, client secrets, private keys or cookies are stored in this manifest.

## 5. Runtime / worker release references

- WORK-01: **PARCIAL** — current Worker SHA deployment skipped; previous successful SHA remains effective.
- WORK-02: **E4 OPERACIONAL — PASS** — real production outbox → durable job → handler → audit/telemetry evidence exists.
- WORK-03: **ABERTO** — readiness/healthy-idle observability remains insufficient.
- WORK-04: **PARCIAL / CORRETO** — deterministic business-event idempotency and replay protection are present; external destination atomic dedupe remains pending.

## 6. Backup / DR release references

- BAK-01: **ABERTO** — deployment success exists, but real backup artifact, checksum and retention evidence are not yet attached.
- DR-01: **ABERTO** — independent restore proof is not yet attached.

## 7. Environment / release gates

- ENV-01: **BLOQUEADO** — dev/staging parity remains unresolved.
- ENV-02: **PARCIAL** — environment contract remains incomplete.
- CI-02: **ABERTO** — component promotion remains intentionally independent.
- REL-01: **MANIFEST CREATED / RELEASE-CONTROL RECORD ESTABLISHED**; final gate remains open until all P0/P1 blockers are reconciled.
- FINAL-01: **BLOQUEADO** while P0/P1 items remain open.

## 8. Evidence policy

1. Git `main` HEAD is not assumed to equal every production component SHA.
2. A successful deployment proves deployment state, not business functionality.
3. A skipped deployment is not a promotion.
4. Database migration state is determined from live Neon evidence, not repository file count alone.
5. Runtime E4 requires direct, reproducible evidence; structural tests do not become production evidence by inference.
6. Authentication tokens and other secrets are never committed to this manifest.

## 9. Next blockers after this manifest

1. **API-06:** capture real authenticated operator HTTP 403 for `ops:diagnostics`; no synthetic permission change is allowed.
2. **WORK-01 / WORK-03:** reconcile Worker promotion/readiness without forcing an unrelated deploy.
3. **BAK-01:** obtain real backup object + checksum + retention evidence.
4. **DR-01:** execute independent restore proof.
5. **ENV-01 / ENV-02:** reconcile environment parity and contract.
6. Re-run the final regression gate and only then evaluate **FINAL-01**.

---
**Manifest conclusion:** production is currently a multi-SHA release. Web/API are effective at `e7e35824...`; the Worker remains effectively at `6348d292...` because the newer Worker deployment was skipped. This is an explicit controlled state, not an inferred mismatch.
