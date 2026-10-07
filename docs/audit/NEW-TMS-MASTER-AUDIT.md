# NEW TMS — Master Audit & Production Completion Ledger

> Living document. Updated at the end of every approved checkpoint.
> Rule: do not promote a component from implementation to operation/production without runtime evidence.

## Control metadata

- Project: New TMS
- Repository: `alexoaraujo83/TMS`
- Branch under audit: `audit/new-tms-master-2026-10-02`
- Base: `main`
- Audit start: 2026-10-02
- Final target: **PRODUÇÃO CONCLUÍDA**

## Independent specialist areas

1. Backend/API
2. Frontend/Web
3. Database
4. Auth0/Identity
5. Worker/Outbox
6. Infra/Deploy
7. Segurança/Multi-tenancy
8. CI/CD
9. Testes
10. Observabilidade
11. Backup/DR

These areas remain independent even when they share the same repository or infrastructure.

## State machine

DISCOVER → ANALYZE → CLASSIFY → CORRECT → TEST → EVIDENCE → NEXT

State labels:

- NÃO INICIADO
- DESCOBERTO
- IMPLEMENTADO
- PARCIAL
- BLOQUEADO
- TESTADO
- APROVADO
- OPERACIONAL
- PRODUÇÃO
- PRODUÇÃO CONCLUÍDA

Existence is not execution; execution is not integration; integration is not operation; operation is not production completion.

---

# Checkpoint E0 — Discovery

Status: **APPROVED**

The project was decomposed into architecture, source, environments, runtime services, security, CI/CD, testing, observability and DR domains.

---

# Checkpoint E1 — Architecture and repository structure

Status: **APPROVED**

## Repository architecture

```
TMS
├── apps/
│   ├── web/        # Frontend / Next.js
│   ├── api/        # Backend / NestJS
│   └── worker/     # Async processing
├── packages/
│   ├── database/
│   ├── auth/
│   ├── security/
│   ├── freight/
│   ├── matching/
│   ├── contracts/
│   ├── config/
│   └── observability/
├── scripts/
├── infra/
│   ├── auth0/
│   └── backup/
├── .github/
│   └── workflows/
└── docs/
```

## E1 area classification

| Area | E1 status |
|---|---|
| Architecture | APPROVED |
| Backend/API | IMPLEMENTED / OPERATIONAL |
| Frontend/Web | IMPLEMENTED / PRODUCTION |
| Database | OPERATIONAL |
| Auth0/Identity | IMPLEMENTED; E4 runtime gate pending |
| Worker/Outbox | OPERATIONAL |
| Infra/Deploy | OPERATIONAL |
| Security/Multi-tenancy | IMPLEMENTED; E4 behavioral gate pending |
| CI/CD | OPERATIONAL |
| Tests | FOUNDATION; hardening pending |
| Observability | IMPLEMENTED |
| Backup | OPERATIONAL |
| Restore | VERIFIED |
| DR | OPERATIONAL; formal gates pending |
| Global production completion | NOT COMPLETED |

## Historical decisions preserved

- Do not create artificial backup manifests.
- Do not run a manual backup solely to manufacture evidence for Backup Manifest Persistence.
- The next valid persistence evidence must come from the real scheduled backup cycle.
- Auth0 authentication must remain distinct from TMS authorization/membership/tenant enforcement.
- RLS and cross-tenant isolation require behavioral runtime evidence, not only schema inspection.

---

# E2 — Integration and production-state audit

Status: **IN PROGRESS — NOT CLOSED**

Objective: verify the real integration chain independently for all specialist areas before advancing to E3.

## E2 evidence recorded

### E2-001 — Repository / CI source
- Repository is public and active.
- Default branch: `main`.
- The audit ledger itself is maintained on `audit/new-tms-master-2026-10-02`.
- GitHub Actions workflows include CI, database migrations, Auth0 production workflows, backup, and restore verification.
- Result: **VERIFIED / E2 remains open for runtime linkage checks**.

### E2-002 — Frontend/Web
- Vercel project for `tms-web` is present.
- Production deployment evidence exists in the current deployment history.
- The current audit branch also generated a non-production deployment; this must not be confused with production.
- Result: **PRODUCTION DEPLOYMENT EXISTS; runtime/auth smoke evidence still required for E2 closure**.

### E2-003 — Backend/API
- Vercel project `tms-core-api` is present.
- Latest verified production deployment is associated with `main` commit `0445a5ca2df20231bce4355081eaa4323750ba18`, merge of PR #122 (`fix(backup): verify manifest persistence`).
- Result: **PRODUCTION DEPLOYMENT VERIFIED; runtime API smoke/auth checks still required for E2 closure**.

### E2-004 — Database
Read-only production inspection against Neon project `shiny-hall-34679912` / database `neondb` returned:
- PostgreSQL 17.11.
- 22 public tables.
- `schema_migrations` latest migration: `0039_backup_manifests.sql`.
- Migration 0039 applied at `2026-10-01T05:34:43.475Z`.
- `backup_manifests` table exists and currently contains **0 rows** on the current main branch read.
- `tms_app` has `rolbypassrls=false`.
- `authenticator` has `rolbypassrls=false`.
- `neondb_owner` has `rolbypassrls=true` and is therefore not suitable as the behavioral RLS proof role.
- Tenant-scoped application tables have RLS and FORCE ROW LEVEL SECURITY enabled.
- Policies use `current_setting('app.tenant_id', true)` for tenant isolation.
- Main branch metadata identifies the active read/write compute as `ep-red-mountain-ac177cgo` in `aws-sa-east-1`, with both direct and pooled host forms available.
Result: **DATABASE INTEGRATION VERIFIED; behavioral RLS test and manifest persistence evidence remain open**.

### E2-005 — Auth0 / Identity
- Auth0 production deployment/read-only workflows exist in GitHub Actions.
- The project architecture separates Auth0 authentication from TMS membership/authorization.
- Current checkpoint does not yet contain a fresh runtime proof of login → tenant claim → API authorization.
- Result: **OPEN**.

### E2-006 — Worker / Outbox
- Railway production environment contains independent `tms-worker` and `tms-backup-worker` services.
- `tms-backup-worker` source is `alexoaraujo83/TMS`, branch `main`, Dockerfile `infra/backup/Dockerfile`, start command `/app/backup.sh`, cron `0 2 * * *`, restart policy `NEVER`.
- Railway production configuration exposes a dedicated `NEON_DATABASE_URL` variable for `tms-backup-worker`.
- User-provided masked runtime value confirms that the configured host is `ep-red-mountain-ac177cgo-pooler.sa-east-1.aws.neon.tech`, database `neondb`, using `neondb_owner`, `sslmode=verify-full`, `channel_binding=require`. The password was not recorded in this ledger.
- This host/branch target matches the audited Neon production main branch endpoint. Therefore the earlier hypothesis that the worker was simply writing to a different Neon branch is **not supported by current evidence**.
- Latest deployment `2f5292f6-e2df-489c-b782-1b32e1ddf934` is **SUCCESS**, created at `2026-10-02T17:02:39Z`, from commit `0445a5ca...` (PR #122).
- **Critical timeline correction:** the real scheduled backup logged at `2026-10-02T02:03:31Z` occurred **before** that 17:02 deployment. The deployment active before the cron was commit `2982600520dc2ff4046c33f2f713062893ea6f76` (PR #121-era production revision), not `0445a5ca...`.
- The `backup.sh` at commit `298260...` already contains the `INSERT INTO public.backup_manifests` and logs `manifest_status=recorded`, but it does **not** contain the later `db_fingerprint` or `manifest_persisted_count` verification code introduced by PR #122. fileciteturn125file0L1-L7
- Therefore the absence of `db_fingerprint`, `manifest_persisted=true`, and `manifest_persisted_count=1` in the 02:03 cron log is now **explained by deployment chronology**, not by a Railway log-ingestion defect.
- The 02:03 cron nevertheless logged `INSERT 0 1`, `backup_id=20261002T020330Z`, `backup_status=verified`, and `manifest_status=recorded`.
- The current source at `0445a5ca...` contains the newer post-insert persistence check. fileciteturn121file0L1-L7
- Result: **WORKER RUNTIME VERIFIED; 2026-10-02 manifest INSERT is evidenced, but durable post-run visibility remains unproven.**

### E2-007 — Security / Multi-tenancy
Schema evidence confirms tenant isolation policies and FORCE RLS on application tables.
However, schema evidence alone does not prove behavioral isolation.
Required next test:
1. authenticated tenant A;
2. attempt tenant-B access;
3. verify denial/empty result as designed;
4. verify application role cannot bypass RLS.
Result: **OPEN**.

### E2-008 — CI/CD
Workflow inventory verified:
- `ci.yml`
- `database-migrate.yml`
- `database-migrate-nonprod.yml`
- `auth0-production-deploy-export.yml`
- `auth0-production-readonly.yml`
- `backup-now.yml`
- `restore-verify.yml`
- `platform-tooling.yml`

Restore Verification workflow run **#28 / workflow run 37011479069** completed successfully on 2026-10-02.
It ran against commit `cac32ced8d3b92699afe4d695b715f1cf22bc473`.
Result: **RESTORE VERIFICATION PASS**; this is not the same as global production completion.

### E2-009 — Observability
- Fresh Railway runtime logs for the real scheduled backup are available, including backup id, checksum, object, byte count, PostgreSQL version, table count, migration count, INSERT result and manifest status.
- The earlier apparent absence of `db_fingerprint` and `manifest_persisted_count` is now explained by the fact that the cron executed before PR #122 was deployed; those lines did not exist in the active `backup.sh` at that time.
- Neon SQL telemetry is not available for this project/region (`telemetry_not_enabled`), so the database cannot provide a historical SQL trace to independently prove or disprove a later DELETE.
- Broader API/Web/Auth0 runtime correlation remains pending.
- Result: **PARTIALLY VERIFIED**.

### E2-010 — Backup / DR
- Backup workflow exists and is manual-dispatch only; it must not be invoked merely to manufacture evidence.
- The real scheduled cron `0 2 * * *` executed on 2026-10-02.
- The production revision active at that time was commit `2982600520dc2ff4046c33f2f713062893ea6f76`, whose `backup.sh` contains the manifest INSERT but not the later post-insert count verification. fileciteturn125file0L1-L7
- Railway logged `INSERT 0 1`, `backup_id=20261002T020330Z`, `manifest_status=recorded`, backup verification and retention verification.
- A later independent read of the production main branch returned `backup_manifests = 0`.
- The supplied Railway `NEON_DATABASE_URL` target matches the production main branch endpoint and uses `neondb_owner`, so wrong-branch routing is no longer the leading explanation.
- Neon project operations show no branch reset/restore operation on the production main branch after the relevant period; the visible main-branch operations are historical endpoint/config operations. This reduces, but does not eliminate, the possibility of database timeline replacement as the explanation.
- Neon SQL telemetry is unavailable in this region, so a historical `DELETE` cannot currently be proven or disproven from database telemetry.
- No manual backup, artificial INSERT, restore, or data mutation will be used to manufacture evidence.
Result: **OPEN — MANIFEST DURABILITY/PERSISTENCE DISCREPANCY REQUIRES NON-DESTRUCTIVE RECONCILIATION**.

## E2 current blockers

1. Fresh Auth0 → JWT → API → TenantContext runtime proof.
2. Behavioral cross-tenant/RLS negative test using application role.
3. Broader production observability/API-Web runtime correlation.
4. Reconcile the 2026-10-02 `INSERT 0 1` evidence with the current zero-row `backup_manifests` state.
5. Establish post-insert durability using a future real scheduled cycle running the already-deployed PR #122 verification code; no manual backup will be used.
6. RPO/RTO operational evidence still needs final consolidation.

## E2 decision

**Do not advance to E3 yet.**

E2 has produced material integration evidence, but it is not complete. The next work remains inside E2 until the open gates above are either verified or explicitly blocked with evidence.

---

## E2 update — 2026-10-05 — real scheduled backup persistence proof

A new real scheduled backup cycle ran in Railway Production; no manual backup, artificial manifest insertion, restore, or mutation was used to obtain this evidence.

- Service: `tms-backup-worker`.
- Real cycle: `backup_start=20261005T020011Z`.
- `db_fingerprint=neondb|neondb_owner|127.0.0.1/32|5432|17.11`.
- `INSERT 0 1` was emitted at 2026-10-05T02:00:51Z.
- Post-insert verification emitted `manifest_persisted=true` and `manifest_persisted_count=1`.
- `backup_id=20261005T020011Z`.
- Object: `tms/postgres/20261005T020011Z/tms-20261005T020011Z.dump.enc`.
- Artifact size: `193632` bytes.
- SHA-256: `b5606d25af13f4636a4d6a0fb80e8256ddf3fa4962ac69b72e69ff8ad4287da2`.
- `public_table_count=26` and `migration_count=41`.
- `manifest_status=recorded`, `backup_status=verified`, `retention_status=verified`.
- Retention reported `retention_deleted_objects=0`.

### Result

**BAK-01 / manifest persistence: E4 OPERATIONAL — PASS.** The previous discrepancy is no longer the active blocker: the already-deployed verification code has now produced positive evidence on a real scheduled cycle after PR #122.

### Remaining DR limitation

This closes the backup execution/persistence gate but does **not** by itself close DR-01. Current DoD still requires restoration of the current artifact in isolated infrastructure and measured RPO/RTO evidence.

## E2 status reconciliation

- Backup persistence: **VERIFIED operationally**.
- Worker runtime/readiness: **VERIFIED operationally**.
- API authorization diagnostic gate: **VERIFIED operationally**.
- Auth0 full login → tenant claim → API JWT → TenantContext chain: **still open unless separately evidenced**.
- Behavioral production RLS/cross-tenant matrix: **still open**.
- Current-artifact isolated restore + measured RPO/RTO: **still open**.
- Global E2: **IN PROGRESS — NOT CLOSED**.


## E2 update — authenticated production runtime and authorization reconciliation

The versioned Auth0 production checklist contains controlled Production-session evidence showing:

- `authenticated=true` with the Production Auth0 issuer;
- audience includes `urn:tms:api:production`;
- an Auth0 subject and concrete tenant ID are present;
- tenant-A visibility succeeds;
- synthetic tenant-B visibility is denied/hidden;
- the tenant-isolation probe reports `rlsIsolation=true`;
- raw token/cookie material was not retained.

This is valid runtime evidence for the identity → tenant-context portion of the chain and strengthens the RLS boundary evidence. It does **not** close the complete DB-04 behavioral gate because the evidence bundle does not prove cross-tenant writes, missing-tenant-context denial, role-bypass resistance, or a recorded real `tms_app` session. It also does not by itself prove the live Auth0 Action/binding/Connection configuration; the read-only Production export/reconciliation remains an AUTH-01 requirement.

Separately, the current production authorization diagnostic has a positive/negative pair: an operator session received HTTP 403 for the diagnostic permission while an authorized administrative session received HTTP 200 with the authenticated tenant context. **API-06 — E4 PASS.**

### E2 gate status after reconciliation

- Identity/authenticated Production runtime: **PARTIALLY VERIFIED / substantially evidenced**.
- Tenant claim + TenantContext: **VERIFIED by controlled runtime evidence**.
- API authorization diagnostic: **E4 PASS**.
- Full behavioral RLS matrix: **OPEN**.
- Live Auth0 configuration export/reconciliation: **OPEN**.
- Current-artifact isolated restore + measured RPO/RTO: **OPEN**.
- E2: **IN PROGRESS — NOT CLOSED**.


## E2 update — 2026-10-06 — direct Neon corroboration of real backup manifest persistence

A read-only query against the audited Production Neon database now independently corroborates the real scheduled backup persistence.

- `public.backup_manifests` currently contains **3 rows**.
- Latest row: `backup_id=20261006T020058Z`.
- Latest `object_path`: `tms/postgres/20261006T020058Z/tms-20261006T020058Z.dump.enc`.
- Latest artifact size: `193632` bytes.
- Latest SHA-256: `c42b510533d85cdf96c83800e22f151befdcf7b9daf557ee0a34dac1fa5f6e82`.
- Latest row reports `public_table_count=26`, `migration_count=41`, `integrity_status=verified`, `retention_status=verified`, `manifest_version=1`.
- Latest manifest `created_at=2026-10-06T02:00:58Z` and `recorded_at=2026-10-06T02:01:41.551Z`.
- The two preceding persisted manifests are the real scheduled cycles `20261004T020353Z` and `20261003T020353Z`.
- Railway Production logs for the 2026-10-06 cycle independently show `INSERT 0 1`, `manifest_persisted=true`, `manifest_persisted_count=1`, `manifest_status=recorded`, `backup_status=verified` and `retention_status=verified`.
- No manual backup, artificial manifest insertion, restore, or production mutation was used.

### Result

**BAK-01 / manifest persistence: E4 CONFIRMED — PASS.** This is stronger than worker-log-only evidence because the same real scheduled backup is now visible as a persisted row in the Production `backup_manifests` table.

### RPO observation

The observed real scheduled cycles were:

| Cycle | Backup start |
|---|---|
| 2026-10-03 | 02:03:53Z |
| 2026-10-04 | 02:03:53Z |
| 2026-10-05 | 02:00:11Z |
| 2026-10-06 | 02:00:58Z |

Observed inter-backup gaps are approximately **24:00:00**, **23:56:18**, and **24:00:47**. Therefore the current scheduled-backup cadence demonstrates an observed worst-case interval of approximately **24h00m47s**. At the audit observation time (2026-10-06 21:05 local / 2026-10-07 00:05Z), the latest successful backup was approximately **19h04m** old.

This is an observed operational RPO envelope, not yet a formal business RPO commitment. Formal DR-01 still requires isolated restoration of the current artifact and measured restore/RTO timing.

## E2 update — 2026-10-06 — DB-04 execution boundary revalidated

The repository's DB-04 implementation was re-read at the audited production source revision.

- `packages/database/test/rls-runtime.integration.test.ts` uses separate administrative and restricted runtime pools.
- The runtime suite covers cross-tenant SELECT invisibility, cross-tenant INSERT rejection, tenant reassignment UPDATE rejection, cross-tenant DELETE invisibility, and pooled tenant-context non-leakage.
- `docs/audit/DB-04-E4-RUNBOOK.md` additionally requires explicit Production-session evidence for `current_user=tms_app`, `rolbypassrls=false`, own-tenant visibility, cross-tenant read denial, cross-tenant write denial, rollback/no-persistence and post-rollback tenant-context clearing.
- A fresh direct Neon read confirms the connector session remains `neondb_owner` with `rolbypassrls=true`. It therefore remains invalid as a DB-04 behavioral proof role.
- The existing connected GitHub tool surface still provides workflow-run/job/artifact retrieval but no workflow-dispatch capability. No Production test credential was created, substituted, or exposed.
- No RLS policy, grant, role, credential, AuthGuard or Production data was changed.

### Result

**DB-04: BLOCKED / E4 PENDING.** The implementation and CI regression path are strong, but the mandatory Production behavioral execution remains unproven. The correct closure path is still a controlled execution using the real restricted `tms_app` runtime connection, with safe evidence only.

## E2 update — 2026-10-06 — current-artifact restore path reviewed

The current restore control was revalidated.

- `.github/workflows/restore-verify.yml` accepts a selected verified backup object only through `workflow_dispatch`.
- The workflow uses the protected `restore-verification` environment.
- `RESTORE_DATABASE_URL` is required to be an isolated recovery target; the workflow explicitly rejects targets that look like production/local.
- `infra/backup/restore-verify.sh` downloads the encrypted artifact and manifest, verifies object identity, SHA-256, byte count and manifest metadata, decrypts the dump, restores it with PostgreSQL 17 `pg_restore`, then validates PostgreSQL major version, public table count and migration count.
- The latest real artifact is now known precisely as `tms/postgres/20261006T020058Z/tms-20261006T020058Z.dump.enc`.
- No restore was dispatched from this session because the connected GitHub tool surface has no workflow-dispatch operation; no production restore target was used.

### Result

**DR-01: OPEN / CONTROL PATH VERIFIED.** The isolated restore mechanism is well-defined and fail-closed, but current-artifact restore execution and measured RTO are still required before DR can be marked fully verified.

## E2 gate status after 2026-10-06 reconciliation

- Backup manifest persistence: **E4 CONFIRMED — PASS**, independently corroborated in Production Neon.
- Worker runtime/readiness: **E4 PASS**.
- API authorization diagnostic: **E4 PASS**.
- Authenticated Production identity / tenant claim / TenantContext: **SUBSTANTIALLY VERIFIED**.
- Full Production DB-04 behavioral RLS matrix: **BLOCKED / PENDING**.
- Live Auth0 Production export/reconciliation: **OPEN / P0**.
- Current-artifact isolated restore + measured RTO: **OPEN**.
- Formal DR/RPO closure: **OPEN**.
- Broader production observability correlation: **PARTIALLY VERIFIED**.
- **E2 remains IN PROGRESS — NOT CLOSED.**

# Final Definition of Done

The project may only be marked **PRODUÇÃO CONCLUÍDA** after all mandatory gates are evidenced:

- source approved
- CI approved
- build approved
- frontend operational
- backend operational
- database operational
- migrations validated
- Auth0 validated
- tenant claim validated
- TenantContext validated
- RLS validated behaviorally
- cross-tenant isolation validated
- worker operational
- outbox operational
- durable jobs operational
- idempotency/replay validated
- audit validated
- observability validated
- backup validated
- restore tested
- DR/RPO/RTO evidenced
- production deployed
- production smoke tests passed
- regression passed
- no critical blocker open

## Update protocol

At the end of every checkpoint:

1. Record evidence.
2. Record result.
3. Record unresolved blockers.
4. Update area statuses.
5. Update global status.
6. Commit the document.
7. Only then begin the next checkpoint.

No checkpoint is considered complete merely because its code/configuration exists.
