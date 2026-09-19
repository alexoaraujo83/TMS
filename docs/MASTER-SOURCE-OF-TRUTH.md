# TMS — MASTER SOURCE OF TRUTH (SSOT)

> Status: **ACTIVE / INITIAL CONSOLIDATION**
> Baseline date: **2026-09-19**
> Canonical repository: **alexoaraujo83/TMS**
> Canonical branch for this snapshot: **main**
> Baseline commit: **5b32eb464db5607973c9ecccc7a3e973e6015f8c**

## 1. Operating rules

This document follows the project master prompt. Evidence levels:

- E0 — not verified
- E1 — existence
- E2 — execution
- E3 — integration
- E4 — operational/repeatable

Statuses:

- CONCLUÍDO/COMPROVADO
- FUNCIONAL
- PARCIAL
- IMPLEMENTADO/NÃO VALIDADO
- CONFIGURADO
- EM VALIDAÇÃO
- QUEBRADO
- AUSENTE
- OBSOLETO
- DUPLICADO
- BLOQUEADO
- PENDENTE
- NÃO APLICÁVEL

Priority:

- P0 — critical/blocking
- P1 — high
- P2 — important
- P3 — optimization

No configuration, file, deployment, migration, test definition or documentation is treated as runtime proof by itself.

---

## 2. Current state — executive snapshot

| Area | Current evidence | Level | Status | Priority |
|---|---|---:|---|---|
| GitHub repository | Repository exists, public, default branch main | E1 | CONFIGURADO | P2 |
| Main HEAD | 5b32eb464db5607973c9ecccc7a3e973e6015f8c | E1 | COMPROVADO | — |
| GitHub CI on main HEAD | CI run #921 succeeded | E2 | FUNCIONAL | P1 |
| Monorepo structure | apps/api, apps/web, apps/worker + packages | E1 | CONFIGURADO | P2 |
| Database project | Neon project `tms` exists | E1 | CONFIGURADO | P1 |
| Neon main/development/staging | branches exist and are ready | E1/E2 | FUNCIONAL | P1 |
| RLS | Public business tables have row security enabled | E2 | PARCIAL / requires runtime isolation proof | P0 |
| Vercel Web | Production deployment on main is READY | E2 | FUNCIONAL | P1 |
| Vercel Core API | latest observed deployments remain ERROR; current deployment is failed | E2 | QUEBRADO | P0 |
| Railway Worker | latest deployment SUCCESS | E2 | FUNCIONAL | P1 |
| Railway Backup Worker | cron 0 2 * * *, latest deployment SUCCESS | E2 | FUNCIONAL | P1 |
| Railway legacy backup-worker | service exists with no deployment | E1 | OBSOLETO? NÃO VALIDADO | P2 |
| Auth0 direct verification | No Auth0 connector available in current toolset | E0/E1 | NÃO VERIFICADO | P0 |
| Auth0 automation in repository | PR #48 and auth0 infrastructure/automation are present | E1 | IMPLEMENTADO/NÃO VALIDADO | P0 |
| Backup/restore | repository/issues report real backup + isolated restore evidence | E2/E3 | PARCIAL | P1 |
| External webhook receiver idempotency | implementation has idempotency key; receiver-side exactly-once not proven | E2/E3 | PARCIAL | P1 |
| SSOT before this snapshot | no repository result for a canonical “SOURCE OF TRUTH” document | E0 | AUSENTE | P1 |

---

## 3. Repository baseline

Canonical repository: `alexoaraujo83/TMS`.

Observed:

- default branch: `main`
- visibility: public
- archived: false
- current HEAD: `5b32eb464db5607973c9ecccc7a3e973e6015f8c`
- latest commit message: `docs(web): align Auth0 namespace example`
- latest commit is unsigned
- repository contains `.github`, `apps`, `packages`, `docs`, `infra`, Docker/compose files, pnpm workspace, Turbo configuration and Vercel/Railway configuration.

### Application topology

```text
apps/
├── api
├── web
└── worker
```

### Packages observed

```text
packages/
├── audit
├── auth
├── config
├── database
├── freight
├── matching
├── security
├── shared
└── tenancy
```

### Root toolchain

- pnpm 11.24.0
- Node 24.20.0
- Turbo 2.10.12
- TypeScript 6.0.3
- Prettier 3.9.6

Root scripts include format, lint, typecheck, test and build gates.

---

## 4. CI/CD baseline

Observed GitHub workflows on main:

- `.github/workflows/ci.yml`
- `.github/workflows/database-migrate.yml`

Latest main CI:

- run: #921
- workflow: CI
- commit: `5b32eb464db5607973c9ecccc7a3e973e6015f8c`
- status: completed
- conclusion: success

This is execution evidence for that CI run, not proof that every production integration is operational.

---

## 5. Open work already recorded in GitHub

Important open issues found during reconciliation include:

### Issue #32 — Durable Jobs

Current issue evidence says:

- DB-backed Durable Jobs path is proven in CI.
- tenant isolation, claiming, leases, retry/backoff, terminal failure and telemetry are covered.
- heartbeat/loss handling is covered.
- real `external.webhook` handler exists.
- outbound idempotency key uses durable job ID.
- receiver-side duplicate/retry idempotency and operational webhook readiness remain unproven.

**SSOT classification:** P1 / PARCIAL.

### Issue #28 / #29 — Backup / DR

Current issue evidence says:

- isolated Neon restore is proven.
- external PostgreSQL backup worker exists.
- real backup execution and remote checksum verification were proven.
- recurring execution/retention evidence, operational ownership and business-approved RPO/RTO remain unresolved.

**SSOT classification:** P1 / PARCIAL.

---

## 6. Neon / PostgreSQL

Canonical Neon project observed:

- project name: `tms`
- project id: `shiny-hall-34679912`
- region: `aws-sa-east-1`
- PostgreSQL: 17
- default branch: `main`
- main branch is ready.

Observed branches include:

- `main`
- `development`
- `staging`
- validation/restore branches, including `iam-validation-20260918`, `tms-dr-restore-20260916` and other evidence branches.

### Public business tables observed

- audit_events
- carriers
- compliance_checks
- drivers
- durable_jobs
- financial_entries
- freight_assignments
- freights
- gr_requests
- outbox_events
- permissions
- role_permissions
- roles
- schema_migrations
- tenant_memberships
- tenants
- trip_occurrences
- trip_pods
- trips
- users
- vehicles

### RLS state

Runtime inspection of `pg_tables` shows row security enabled on the business tables except:

- `permissions`
- `schema_migrations`

Observed policies use `current_setting('app.tenant_id', true)` for tenant isolation.

Examples:

```text
tenant_id = current_setting('app.tenant_id', true)
```

and for relationship tables:

```text
EXISTS (...) AND tenant_id = current_setting('app.tenant_id', true)
```

This is strong database-state evidence, but **not by itself E3/E4 proof** of the complete identity → tenant → API → DB isolation path.

### PostgreSQL roles observed

- `tms_app`
- `neondb_owner`
- `authenticator`
- `anonymous`
- `authenticated`

Role privilege/use mapping still requires a dedicated gate.

---

## 7. Vercel

Team observed: `alexoaraujo83-8387's projects`.

Relevant projects:

- `tms-web`
- `tms-core-api`

### TMS Web

Observed production deployment:

- project: `tms-web`
- project id: `prj_2IuBDomnpwsMnDQdVwtfeCyfzGxy`
- framework: Next.js
- commit: `5b32eb464db5607973c9ecccc7a3e973e6015f8c`
- state: READY
- target: production

Therefore deployment execution is proven for this deployment.

### TMS Core API

Fresh reconciliation on 2026-09-19:

- project: `tms-core-api`
- project id: `prj_XJxfrZjHBzikSMWgOlO8UE3xt8fn`
- latest observed deployment: `dpl_9VLE2djxiDp3Z1tKhhatzFaEfR9g`
- latest deployment branch: `fix/vercel-monorepo-project-build-config`
- latest deployment commit: `729358bee097c1cec558b32666ebde28775b2a78`
- latest deployment state: ERROR
- Vercel error code: `NEXT_NO_VERSION`
- Vercel framework detected/configured for project: `nextjs`
- error: `No Next.js version detected`
- repository `vercel.json` at this commit contains only the install command; the previous global Web build override was removed
- `apps/api/package.json` is a NestJS package with build `tsc -p tsconfig.json`
- `apps/api/vercel.json` is absent
- deployment target: preview/branch deployment (target is null)
- public deployment URL resolves to Vercel's `Deployment has failed` page
- previous production deployment on `main` (`dpl_EaE4r2PUCJKw7GUST9DjVbwczoFJ`) is also ERROR

Repository-side build configuration was rechecked on `main`:

- root `vercel.json` exists;
- it defines `installCommand: pnpm install --no-frozen-lockfile`;
- it defines `buildCommand: pnpm turbo run build --filter=@tms/web...`;
- `apps/api/package.json` defines the API build as `tsc -p tsconfig.json`;
- `apps/api/vercel.json` does not exist.

Therefore the first configuration mismatch has been narrowed further: the repository-level Web build override was removed, but the dedicated `tms-core-api` Vercel project still has the **Next.js framework preset/configuration**, causing the build to fail before the NestJS API can compile. Vercel currently reports `NEXT_NO_VERSION`.

Vercel's current platform documentation confirms first-class NestJS support and zero-configuration NestJS deployment, so the remaining blocker is project configuration/root detection rather than evidence that NestJS itself is unsupported. citeturn1search5turn1search0

**P0:** change/verify the `tms-core-api` Vercel project framework/root/build configuration so it is detected and built as the NestJS API, then trigger a fresh deployment. Do not add a fake Next.js dependency or alter API code to satisfy the incorrect framework preset. The available connector in this session does not expose a working project-settings mutation path, so the Vercel project setting itself remains unchanged.

After the configuration correction, require successful build evidence followed by `/health` and `/ready` runtime validation.

---

## 8. Railway

Observed project:

- `tms-backup`
- environment: production

Services:

1. `tms-worker`
   - latest deployment: SUCCESS
2. `tms-backup-worker`
   - replicas: 1
   - cron: `0 2 * * *`
   - latest deployment: SUCCESS
3. `backup-worker`
   - no latest deployment observed

The third service is a cleanup candidate but **must not be deleted** until references/consumers are checked and the replacement is confirmed.

---

## 9. Auth0

Direct Auth0 runtime inspection was **not available in the current connected toolset**.

Repository/GitHub evidence nevertheless establishes:

- Auth0 infrastructure directory exists.
- PR #48 exists for automated Post Login Action management.
- intended canonical tenant claim:
  `https://tms-platform.io/claims/tenant_id`
- PR #48 describes expected evidence:
  `status=verified`, `deployed=true`, `bound=true`, canonical tenant claim.

Therefore current Auth0 classification is:

**IMPLEMENTED / NOT VALIDATED (P0)**.

Required next proof:

1. Action exists.
2. Action is published.
3. Action is bound to the correct trigger.
4. user has tenant membership.
5. real Access Token contains tenant claim.
6. API validates issuer/audience/signature.
7. API extracts tenant context.
8. DB receives the tenant context.
9. cross-tenant access is denied.

No secret/token value is stored in this SSOT.

---

## 10. Environment ledger — initial

Only non-secret metadata is recorded here.

| Variable/config area | Source | Runtime proof | Status |
|---|---|---|---|
| Node/pnpm versions | package.json | E1 | CONFIGURED |
| Auth0 issuer example | repository env examples | E1 | CONFIGURED / runtime unverified |
| Auth0 tenant claim namespace | repository + PR #48 | E1 | IMPLEMENTED / runtime unverified |
| Database connection roles | Neon role inventory | E1 | CONFIGURED / consumer mapping pending |
| Railway service variables | Railway metadata available | E1 | CONFIGURED / secret values withheld |
| Vercel variables | project exists; runtime value audit pending | E0/E1 | PENDING |

Secret values are not copied into the SSOT.

---

## 11. Evidence ledger

| ID | Area | Claim | Evidence | Level | Status |
|---|---|---|---|---:|---|
| E1-001 | GitHub | Canonical repository exists | GitHub repository metadata | E1 | COMPROVADO |
| E2-001 | GitHub CI | Main HEAD passed CI | GitHub Actions run #921 | E2 | COMPROVADO |
| E1-002 | Repository | Monorepo apps exist | main tree | E1 | COMPROVADO |
| E1-003 | Repository | Domain packages exist | main tree | E1 | COMPROVADO |
| E1-004 | Neon | TMS project exists | Neon project inventory | E1 | COMPROVADO |
| E2-002 | Neon | Main/development/staging branches ready | Neon branch inventory | E2 | COMPROVADO |
| E2-003 | Database | Business tables have RLS enabled | pg_tables inspection | E2 | COMPROVADO |
| E2-004 | Database | Tenant policies use app.tenant_id | pg_policies inspection | E2 | COMPROVADO |
| E2-005 | Railway | Worker deployment succeeded | Railway deployment metadata | E2 | COMPROVADO |
| E2-006 | Railway | Backup worker deployment succeeded | Railway deployment metadata | E2 | COMPROVADO |
| E2-007 | Vercel | Web production deployment READY | Vercel deployment metadata | E2 | COMPROVADO |
| E2-008 | Vercel | Core API latest deployment fails with `NEXT_NO_VERSION` under Next.js project configuration | Vercel deployment metadata + repository configuration | E2 | COMPROVADO |
| E1-005 | Auth0 | Automation implementation exists in repo/PR | PR #48 + repository infrastructure | E1 | COMPROVADO |
| E3-001 | Backup | External backup/isolated restore have prior project evidence | Issues #28/#29 | E2/E3 | PARCIAL |
| E3-002 | Durable Jobs | DB-backed runtime path proven in CI | Issue #32 evidence | E2/E3 | PARCIAL |

---

## 12. Blocker ledger

| ID | Blocker | Area | Severity | Status | Required action |
|---|---|---|---|---|---|
| B-P0-001 | Core API production deployment is ERROR / configuration mismatch | Vercel/API | P0 | OPEN | Inspect project root/build configuration and redeploy only after correction |
| B-P0-002 | Real Auth0 → token → API → tenant → RLS chain not directly validated | Auth/IAM/Tenancy | P0 | OPEN | Obtain direct Auth0/runtime evidence and execute positive/negative isolation tests |
| B-P1-001 | Recurring backup/retention/RPO/RTO operational evidence incomplete | DR | P1 | OPEN | Validate schedule, retention and restore cadence; obtain business approval for targets |
| B-P1-002 | Receiver-side webhook idempotency and operational ownership not proven | Durable Jobs/Webhooks | P1 | OPEN | Validate external receiver semantics and operational monitoring |
| B-P2-001 | Railway `backup-worker` has no deployment | Infrastructure cleanup | P2 | OPEN | Trace references before deletion/deactivation |

---

## 12A. API authentication/tenancy code-path reconciliation

Fresh source inspection on 2026-09-19 establishes that the API contains a concrete Auth0/tenant authorization path in code:

- `packages/auth/src/index.ts` implements JWT verification with RS256, issuer, audience and remote JWKS validation and extracts the canonical tenant claim `https://tms-platform.io/claims/tenant_id`.
- `apps/api/src/common/auth.guard.ts` reads `Authorization: Bearer`, validates issuer/audience/JWKS configuration, requires the tenant claim, rejects a mismatching `x-tenant-id`, and checks active membership using `check_tenant_membership`.
- `PermissionGuard` fails closed when a permission is not declared and checks the authenticated context.
- Business controllers inspected (freight, finance, compliance, operations, trip execution) use `@UseGuards(AuthGuard, PermissionGuard)` and `@RequirePermission(...)`.
- `packages/database/src/transaction.ts` sets `app.tenant_id` transaction-locally before repository work.
- `verifyTenantMembership` resolves the Auth0 subject to the application user/tenant membership.

This is **E1/E2 code-path evidence**, not E3 runtime integration evidence. A real Auth0 token and production request are still required to prove the complete chain.

### Important finding

`TenantGuard` exists but is not applied to the inspected business controllers. The current controllers rely on `AuthGuard` to establish the tenant context and on `PermissionGuard` for authorization. This is not automatically a defect, but it is an architecture/documentation decision that must remain explicit and covered by tests.

### Health endpoint boundary

`/health` is not protected by the business controller guards and returns process-level health. `/ready` performs a database readiness check and requires the runtime database user to be `tms_app`. This distinction is appropriate for infrastructure probes but requires deployment/runtime validation.

## 12B. CHAT 03 — API route, authorization and database access-path inventory

Fresh inspection of the canonical `main` tree on 2026-09-19 covered the API bootstrap, all currently registered business controllers, and the principal PostgreSQL repositories.

### Route protection matrix

| Controller | Route family | AuthGuard | PermissionGuard | Explicit permission metadata |
|---|---|---:|---:|---:|
| HealthController | `/health`, `/ready` | No | No | No |
| FreightController | `/freights/**` | Yes | Yes | Yes |
| ComplianceController | `/compliance/**` | Yes | Yes | Yes |
| FinanceController | `/finance/**` | Yes | Yes | Yes |
| OperationsController | `/operations/**` | Yes | Yes | Yes |
| TripExecutionController | `/operations/trips/:tripId/**` | Yes | Yes | Yes |

No additional business controller was found in the registered API module tree during this pass.

### Authorization findings

- Business controllers consistently apply `@UseGuards(AuthGuard, PermissionGuard)`.
- Every inspected business handler declares `@RequirePermission(...)`.
- `PermissionGuard` fails closed when permission metadata is absent.
- `AuthGuard` requires a Bearer token, validates OIDC configuration, requires the canonical tenant claim, rejects a conflicting `x-tenant-id`, and checks active tenant membership.
- `TenantGuard` remains unused by the inspected controllers. This is recorded as an explicit architectural choice rather than a defect because `AuthGuard` is the component that establishes the authenticated tenant context.

### Database access-path findings

The principal tenant-scoped repositories inspected use `withTransaction` or `withTenantContext`, which establishes `app.tenant_id` transaction-locally before business queries.

Observed examples include:

- freight creation/list/read/status transition;
- freight assignment;
- finance create/list/settle;
- trip create/read/list/transition;
- outbox enqueue/list/claim/publish/fail;
- durable-job enqueue/claim/complete/fail.

The outbox and durable-job `claimPending` methods use an explicit transaction plus `set_config('app.tenant_id', ... , true)` rather than the shared helper. This is functionally aligned with the tenant-context contract, but it is a consistency/refactoring candidate because the common transaction primitive is otherwise the canonical mechanism.

### API bootstrap / operational boundary

- `RequestContextMiddleware` runs for all routes and normalizes `X-Request-Id`, while adding baseline security response headers.
- Global validation uses whitelist + forbid-non-whitelisted + transform.
- `/health` is process-level and intentionally unauthenticated.
- `/ready` performs a database check and verifies `current_user = tms_app`; it is not tenant-scoped and should remain treated as an infrastructure readiness probe, not as proof of application authorization or RLS isolation.

### CHAT 03 conclusion

**Result: technical route inventory substantially reconciled.**

The codebase has a coherent authorization boundary for business APIs and a coherent tenant transaction primitive. No new P0 was created from this pass.

Remaining proof gap is runtime/integration evidence: a real Auth0 access token must traverse the deployed API and demonstrate positive access for tenant A plus denial/isolation for tenant B. The Vercel Core API deployment blocker remains the prerequisite for that runtime gate.


## 12C. Neon runtime reconciliation — 2026-09-19

Fresh read-only inspection of the canonical Neon project `tms` established:

- project: `shiny-hall-34679912`;
- region: `aws-sa-east-1`;
- PostgreSQL: `17.11`;
- default branch: `main` (`br-lingering-shadow-act0vvi9`);
- database: `neondb`;
- inspected database role: `neondb_owner` (therefore privileged/bypass-RLS; this is **not** runtime application evidence);
- application role `tms_app` exists, can login, is not superuser and does not have `rolbypassrls`;
- 31 schema migrations are recorded, latest observed `0031_finance_relationship_invariants.sql`;
- current public schema contains the expected TMS tenancy/RBAC/business/outbox/job tables;
- tenant-scoped business tables have RLS enabled and FORCE ROW LEVEL SECURITY, with one tenant-isolation policy each;
- `permissions` and `schema_migrations` are intentionally not tenant-scoped;
- the main branch currently contains exactly 1 tenant, 1 user and 1 membership.

### RLS evidence

The tenant policies consistently compare `tenant_id` (or the corresponding tenant key) to `current_setting('app.tenant_id', true)`. The `users` and `role_permissions` policies derive isolation through tenant membership/role relationships.

This is **E2 database-state evidence**, not E3 isolation proof.

### Critical validation limitation

Because the canonical main branch currently contains only one tenant, a true:

`Tenant A → Tenant B = blocked`

runtime test cannot yet be demonstrated against production/canonical data without introducing a second test tenant and controlled test fixtures. No data mutation was performed during this audit.

Also, the read-only inspection connection used the privileged `neondb_owner` role, which has `rolbypassrls=true`; therefore successful queries from this connection must **not** be interpreted as evidence that RLS blocks `tms_app`.

The correct E3 gate remains:

1. obtain/validate a real Auth0 access token;
2. exercise the deployed API;
3. use the non-bypass `tms_app` runtime path;
4. validate tenant A positive access;
5. validate tenant B negative isolation;
6. validate membership/permission denial cases.

### Database hygiene observation

Neon currently has multiple historical/validation branches, including `development`, `staging`, IAM validation, restore-proof and DR restore branches. They are not being deleted during audit. Each must be classified before any cleanup decision.


## 13. Reconciliation findings

### Documentation vs runtime

Repository documentation correctly states that existence is not sufficient and production promotion requires measured evidence.

Runtime reconciliation reveals at least one concrete divergence:

- TMS Web has a READY production deployment.
- TMS Core API has an observed ERROR production deployment.

Therefore the global system cannot be marked operationally complete.

### Database vs architecture

Database structure supports multi-tenancy and RLS, but the complete runtime chain remains unproven.

### Auth0 vs repository

Repository has automation and canonical claim documentation, but direct provider/runtime proof remains pending.

### Infrastructure vs cleanup

Railway contains a deployed worker and a separately named backup worker plus an undeployed legacy-looking `backup-worker`. No deletion is authorized yet.

---

## 14. Execution state of the 109-chat operating sequence

| Stage | State |
|---|---|
| CHAT 00 — Orchestrator | EXECUTED |
| CHAT 01 — Baseline | EXECUTED |
| CHAT 02 — Discovery | EXECUTED |
| CHAT 03 — Technical inventory | IN PROGRESS |
| CHAT 04+ | BLOCKER-AWARE QUEUE |

The sequence must continue from the current state rather than restart.

---

## 15. Next execution order

1. **CHAT 03** — complete technical inventory from the canonical main tree.
2. **CHAT 04** — functional traceability.
3. **CHAT 05–08** — structure/architecture reconciliation.
4. **P0 correction path** for the Vercel Core API build error.
5. **CHAT 09–12** — database/ORM/migration/hardening.
6. **CHAT 13–16** — Auth0/IAM/tenancy runtime proof.
7. Continue through the 109-chat sequence, updating this SSOT after each material change.

### Rule

No gate is marked CONCLUÍDO/COMPROVADO without new evidence.

---

## 16. Change history

### 2026-09-19 — API/Auth/Tenancy code-path reconciliation

Actions performed:

- inspected Auth0 verifier implementation;
- inspected API AuthGuard, PermissionGuard and tenant context flow;
- inspected business controllers for guard and permission coverage;
- inspected database transaction tenant-context propagation;
- recorded the distinction between code-path evidence and real-token/runtime integration evidence;
- recorded that TenantGuard exists but is not currently applied to the inspected business controllers;
- recorded `/health` versus `/ready` operational boundary.

### 2026-09-19 — CHAT 03 route and database access-path inventory

Actions performed:

- enumerated the API module tree;
- inspected all registered business controllers and route families;
- verified AuthGuard/PermissionGuard coverage and explicit permission metadata;
- inspected API bootstrap, request context middleware and health/readiness boundary;
- inspected principal tenant-scoped PostgreSQL repositories;
- confirmed use of transaction-local `app.tenant_id` in the main business data paths;
- recorded the shared-helper consistency candidate for outbox/durable-job claim methods;
- no new P0 blocker created by this pass.


### 2026-09-19 — Vercel Core API root-cause refinement

Fresh Vercel deployment inspection established:

- deployment: `dpl_9VLE2djxiDp3Z1tKhhatzFaEfR9g`;
- commit: `729358bee097c1cec558b32666ebde28775b2a78`;
- state: ERROR;
- project framework: `nextjs`;
- error code: `NEXT_NO_VERSION`;
- repository root `vercel.json` no longer contains the previous `@tms/web` build override;
- API package remains NestJS with `tsc -p tsconfig.json`.

This narrows the active P0 from a repository-level build override to the Vercel project framework/root configuration. No fake Next.js dependency was introduced.

### 2026-09-19 — Vercel post-SSOT deployment observation

A new automatic Vercel deployment was observed for the audit branch after the SSOT commit:

- deployment: `dpl_3rd88eoYDiBdAy93ihNvey38ju6g`
- commit: `2d32e13ae00d59deefb32bc453a15c917f6ece6d`
- state at observation time: `BUILDING`

This does not resolve B-P0-001. The gate remains open until the deployment reaches a successful state and `/health` plus `/ready` are validated against the deployed API.


### 2026-09-19 — Neon runtime/database reconciliation

Read-only runtime inspection performed against the canonical `tms` project and `main` branch. Recorded PostgreSQL version, role posture, migration state, schema inventory, RLS/force-RLS coverage, policy definitions, tenant/user/membership cardinality and validation limitations. No database mutation was performed.


### 2026-09-19 — Vercel Core API reconciliation

Actions performed:

- refreshed Vercel team/project inventory;
- confirmed `tms-core-api` project id and latest failed deployment;
- confirmed the failed deployment URL serves Vercel's deployment-failed page;
- re-read repository `vercel.json` and `apps/api/package.json` from `main`;
- confirmed no `apps/api/vercel.json` exists;
- registered the project-level configuration mismatch as the active P0 correction path.

The Vercel connector available in this session did not expose a working mutation path for project settings, so no Vercel production configuration was changed automatically.

### 2026-09-19 — Initial SSOT consolidation

Actions performed:

- repository baseline collected;
- branch inventory collected;
- open PR/Issue evidence collected;
- CI state collected;
- repository structure collected;
- Neon project/branch/table/RLS/role state collected;
- Railway project/service/deployment state collected;
- Vercel project/deployment state collected;
- Auth0 direct inspection identified as unavailable in current toolset;
- initial evidence ledger and blocker ledger created;
- this SSOT introduced as the canonical consolidation document.

No production secrets or token values are stored here.

---

## 17. Definition of Done — current gate

The TMS is **not** at final DoD.

Final DoD remains blocked until, at minimum:

- Core API production deployment is healthy;
- Auth0 real token/claim flow is proven;
- tenant isolation is proven end-to-end;
- P0 issues are resolved or explicitly accepted as blocked;
- backup recurrence/retention/RPO/RTO evidence is established;
- critical regression suite is executed;
- documentation and runtime are reconciled;
- final evidence ledger is complete;
- operational readiness is demonstrated.

---

## 18. Continuity rule

Every subsequent audit must:

```text
CONSULT SSOT
→ VERIFY REAL STATE
→ IDENTIFY DELTA
→ EXECUTE
→ VALIDATE
→ UPDATE SSOT
→ REGISTER EVIDENCE
→ CONTINUE
```

This file is the canonical project consolidation point for the audit cycle.
