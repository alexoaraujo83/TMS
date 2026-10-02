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
- Both services are configured in the same production environment.
- `tms-backup-worker` source is `alexoaraujo83/TMS`, branch `main`, Dockerfile `infra/backup/Dockerfile`, start command `/app/backup.sh`, cron `0 2 * * *`, restart policy `NEVER`.
- `tms-backup-worker` has a production `NEON_DATABASE_URL` variable, but the connected Railway API exposes variable names only; its secret value cannot be independently inspected through the current connector session. Therefore the exact runtime host used by Railway cannot be proven from the variable API without exposing a secret.
- Latest backup deployment `2f5292f6-e2df-489c-b782-1b32e1ddf934` is **SUCCESS**.
- The real 2026-10-02 scheduled execution at `02:03:31Z` logged backup `20261002T020330Z`, successful backup/retention verification, `INSERT 0 1`, and `manifest_status=recorded`.
- Repository source confirms that after the INSERT the script executes a fresh `psql "$NEON_DATABASE_URL"` count query for the same `backup_id` and exits non-zero if the count is not exactly `1`. fileciteturn104file5L84-L96
- Repository search found no `DELETE FROM public.backup_manifests` application path in the audited commit; the only matching source result is the backup INSERT plus its persistence check. fileciteturn105file0L1-L8
- Result: **WORKER RUNTIME VERIFIED; manifest visibility discrepancy remains unresolved**.

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
- Neon SQL telemetry is not available for this project/region (`telemetry_not_enabled`), so the database cannot provide a historical SQL trace to independently prove or disprove a later DELETE.
- Broader API/Web/Auth0 runtime correlation remains pending.
- Result: **PARTIALLY VERIFIED**.

### E2-010 — Backup / DR
- Backup workflow exists and is manual-dispatch only; it must not be invoked merely to manufacture evidence.
- The real scheduled cron `0 2 * * *` executed on 2026-10-02.
- Railway logged `INSERT 0 1` and `manifest_status=recorded` for `backup_id=20261002T020330Z`.
- The backup script itself performs an immediate post-insert count verification against `backup_manifests` using `NEON_DATABASE_URL`. fileciteturn104file5L84-L96
- A later independent read of the production main branch returned `backup_manifests = 0`.
- The current Railway connector cannot expose the secret value of `NEON_DATABASE_URL`, so the exact runtime connection target cannot yet be compared directly with the audit connection without handling a secret.
- No manual backup, artificial INSERT, restore, or data mutation will be used to manufacture evidence.
Result: **OPEN — CONNECTION-PATH / POST-RUN VISIBILITY DISCREPANCY REQUIRES RECONCILIATION**.

## E2 current blockers

1. Fresh Auth0 → JWT → API → TenantContext runtime proof.
2. Behavioral cross-tenant/RLS negative test using application role.
3. Broader production observability/API-Web runtime correlation.
4. Reconcile the exact database target used by Railway `NEON_DATABASE_URL` with the production Neon main branch used by the audit, without exposing the secret.
5. Reconcile why the real cron reports immediate manifest persistence while the later independent main-branch read reports zero rows.
6. RPO/RTO operational evidence still needs final consolidation.

## E2 decision

**Do not advance to E3 yet.**

E2 has produced material integration evidence, but it is not complete. The next work remains inside E2 until the open gates above are either verified or explicitly blocked with evidence.

---

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
