# TMS — AUTH0 Production Promotion Checklist (Operational)

> Living operational checklist. Update this file after every completed step.
> Secrets, access tokens, cookies and full connection strings must never be recorded here.

## Status legend

- [x] Defined/verified in source control
- [ ] Pending validation
- [~] Partially verified; runtime evidence still required
- [!] Blocker/P0

## 0. Current gate

- [x] Auth0 tenant/domain contract exists in source control.
- [x] TMS Web uses `@auth0/nextjs-auth0` v4.
- [x] TMS Web Auth0 client is server-side.
- [x] Access-token endpoint is enabled.
- [x] API validates issuer, audience, JWKS and RS256.
- [x] API requires the TMS tenant claim.
- [x] API re-checks tenant membership in PostgreSQL.
- [x] First-login identity bootstrap exists.
- [x] Post-Login Action source is versioned.
- [x] Post-Login binding is versioned in `infra/auth0/tenant.yaml`.
- [~] Production Action/binding has not yet been independently proven against live Auth0.
- [~] Live Production token/runtime evidence now proves issuer, Production audience, subject and tenant claim for a controlled authenticated session.
- [x] DB-04 Production behavioral RLS gate closed on 2026-10-08: restricted `tms_app`, `rolbypassrls=false`, `rolsuper=false`, own-tenant SELECT visible, cross-tenant SELECT invisible, cross-tenant INSERT/UPDATE rejected with SQLSTATE 42501, savepoint rollback/no-persistence; 6/6 checks PASS.
- [!] AUTH-01 E4 is still open.
- [x] DB-04 behavioral RLS proof is closed; it is not an AUTH-01 blocker.
- [x] Neon Production project `tms / shiny-hall-34679912` and primary `main` branch were identified read-only.

## 1. Auth0 Production live configuration — READ ONLY FIRST

- [ ] Identify live Post-Login Action name and ID.
- [ ] Record deployed/published status.
- [ ] Record trigger runtime/version.
- [ ] Record binding order.
- [ ] Record last-modified timestamp.
- [ ] Confirm TMS Web association where visible.
- [ ] Enumerate every Action bound to the Production Post-Login/Login Flow.
- [ ] Search live Actions for `api.access.deny`, `missing_tenant_id`, tenant metadata checks and unsafe property access.
- [ ] Compare live Action source with `infra/auth0/actions/post-login.js`.
- [ ] Confirm live binding matches `infra/auth0/tenant.yaml`.
- [ ] Do not modify AuthGuard, RLS or grants to work around Auth0 behavior.

**Step result:** BLOCKED/PENDING — the supplied runtime evidence proves a successful authenticated Production token path, but does not identify the live Action/binding configuration. Live Auth0 configuration still requires read-only export/Management evidence.

## 2. TMS Web Application contract

- [x] Application type is Regular Web Application in the project contract.
- [x] Auth0 domain is defined.
- [x] Client ID is defined as an environment secret/config value.
- [x] Client secret is treated as server-only.
- [x] `AUTH0_SECRET` is server-only.
- [~] Production callback URL must be confirmed live.
- [~] Production logout URL must be confirmed live.
- [~] Production Web Origin must be confirmed live.
- [ ] Confirm exact production domain.
- [ ] Remove obsolete production callback/logout/origin entries when safe.

**Step result:** PARTIAL — successful authenticated runtime evidence exists; live application URI configuration remains unverified.

## 3. Connection → TMS Web

- [ ] Identify the exact Production Connection(s).
- [ ] Confirm intended signup/user store.
- [ ] Confirm Connection is enabled for TMS Web.
- [ ] Confirm no unintended Connection is enabled.
- [ ] Confirm Universal Login exposes only intended methods for this application.
- [ ] Record evidence without secrets.

**Step result:** BLOCKED/PENDING — exact live Connection must be observed; do not guess a Connection name.

## 4. Tenant metadata bridge

- [x] Action reads `event.user.app_metadata.tenant_id`.
- [x] Action emits `https://tms-platform.io/claims/tenant_id`.
- [x] Action does not assign tenant from an untrusted signup URL.
- [x] API treats PostgreSQL membership as authoritative.
- [~] Fresh authenticated Production runtime evidence contains tenant ID `19d9a5a4-2d50-4b78-a910-1fdea96fd12e`.
- [ ] Verify controlled test user has the intended `app_metadata.tenant_id` directly in Auth0.
- [ ] Verify tenant UUID corresponds to an active TMS tenant.
- [ ] Verify corresponding local membership exists or first-login bootstrap is exercised.
- [ ] Do not persist the user's token/cookie in evidence.

**Step result:** PARTIAL — tenant claim is proven in the authenticated runtime path; direct Auth0 user metadata and local membership evidence remain pending.

## 5. Auth0 API / token contract

- [x] Production audience is defined as `urn:tms:api:production`.
- [x] Development audience is separate.
- [x] Staging audience is separate.
- [x] API validates issuer.
- [x] API validates audience.
- [x] API uses JWKS.
- [x] API restricts JWT verification to RS256.
- [x] API requires `sub`.
- [x] Live authenticated runtime reports issuer `https://tms-platform.us.auth0.com/`.
- [x] Live authenticated runtime reports Production audience `urn:tms:api:production`.
- [x] Live authenticated runtime reports subject `auth0|6aad217effa00aa441cb0b3f`.
- [x] Live authenticated runtime reports tenant claim `19d9a5a4-2d50-4b78-a910-1fdea96fd12e`.
- [ ] Verify live JWKS endpoint independently.
- [ ] Verify the raw fresh Production token claim set without storing the token.
- [~] Verify token is accepted by Production runtime/API path — authenticated runtime evidence confirms the protected path is operating, but the exact API endpoint/request evidence is not included in this evidence bundle.

**Step result:** VERIFIED/PARTIAL — issuer, Production audience, subject and tenant ID are now evidenced from the authenticated Production runtime. Raw token/JWKS and exact protected API request evidence remain to be captured.

## 6. TMS Web → TMS API

- [x] TMS Web uses Auth0 SDK `createFetcher`.
- [x] Authenticated fetch uses `fetchWithAuth`.
- [x] `NEXT_PUBLIC_API_BASE_URL` is the configured API origin.
- [x] Latest Vercel Production deployment is READY and runs `main` commit `a1ee105ef8ba0078277670096dadcc91cb931bc6`; this proves the latest checklist changes are deployed, not that Production environment variables are correct.
- [~] Authenticated Production runtime path is proven by the supplied `authenticated: true` evidence.
- [ ] Verify no Preview/Development origin is used by Production.
- [ ] Verify protected API request succeeds with a valid token and record endpoint-level evidence.

**Step result:** PARTIAL — latest checklist is deployed to a READY Vercel Production deployment; environment separation and endpoint-level API proof remain pending.

## 7. Tenant authorization

- [x] Missing Authorization header is rejected.
- [x] Missing tenant claim is rejected.
- [x] `x-tenant-id` cannot override authenticated tenant claim.
- [x] API checks `sub + tenant` membership.
- [x] Inactive/missing membership is denied after bootstrap rules.
- [~] Supplied isolation probe shows tenant A is visible and synthetic tenant B is not visible.
- [ ] Run controlled wrong-tenant header test.
- [ ] Run controlled missing-tenant-claim test.
- [ ] Run controlled inactive-membership test.
- [ ] Confirm no cross-tenant resource access across the required protected endpoints.

**Step result:** PARTIAL — one tenant-isolation probe is evidenced; the complete negative authorization suite remains pending.

## 8. First-login identity bootstrap

- [x] `bootstrapAuth0Identity` exists.
- [x] Bootstrap is followed by membership re-check.
- [x] Existing memberships are not implicitly expanded.
- [x] Auth0 subject is linked to the local identity.
- [ ] Execute a controlled first-login test.
- [ ] Verify local user creation/linking.
- [ ] Verify first membership creation according to the documented contract.
- [ ] Verify second request is idempotent.
- [ ] Verify duplicate/conflicting Auth0 subject/email cases are denied.

**Step result:** PARTIAL — the authenticated subject is known, but the supplied evidence does not prove that first-login bootstrap executed or that the local identity/membership was created by bootstrap.

## 9. PostgreSQL / RLS gate DB-04

- [x] Tenant context is part of the API request context.
- [x] Repository architecture installs tenant context transactionally.
- [x] RLS is documented as the final isolation boundary.
- [~] Supplied probe proves same-tenant visibility: `tenantAVisible=true`.
- [~] Supplied probe proves cross-tenant visibility isolation: `tenantBVisible=false` for synthetic tenant B.
- [ ] Obtain/record a real `tms_app` session in Production.
- [~] Direct Neon read-only inspection reached the primary Production branch, but the connector session is `neondb_owner`, not `tms_app`.
- [x] `tms_app` is `rolcanlogin=true`, `rolbypassrls=false`, `rolsuper=false` in Production.
- [x] `neondb_owner` is `rolbypassrls=true`; therefore owner-session queries are not valid DB-04 RLS proof.
- [x] `neondb_owner` cannot `SET ROLE tms_app` because the role membership has `set_option=false`; this prevents treating the connector session as a real `tms_app` session.
- [ ] Execute the complete six DB-04 behavioral isolation tests.
- [ ] Prove cross-tenant read denial independently.
- [ ] Prove cross-tenant write denial.
- [ ] Prove missing tenant context denial.
- [ ] Prove role cannot bypass RLS.
- [ ] Record only safe evidence.

**Step result:** CLOSED / E4 PASS (2026-10-08) — a separate restricted Production runtime probe has now completed the behavioral suite as `tms_app` with `rolbypassrls=false`, `rolsuper=false`, cross-tenant SELECT isolation, cross-tenant INSERT/UPDATE rejection (SQLSTATE 42501), and savepoint rollback/no-persistence. The `neondb_owner` connector inspection remains insufficient by itself, but is no longer needed to close this gate.

## 10. Production environment separation

- [x] Development audience is distinct.
- [x] Staging audience is distinct.
- [x] Production audience is distinct.
- [ ] Verify Vercel Production variables.
- [ ] Verify Vercel Preview variables.
- [ ] Verify Vercel Development variables.
- [x] Verify Railway Production worker variable names: `APP_ENV`, `DATABASE_URL`, `NODE_ENV`, durable-jobs/outbox settings and Railway runtime identifiers are present; values remain redacted.
- [ ] Confirm no Production deployment points to Staging/Development API.
- [ ] Confirm Preview cannot accidentally use Production credentials unless explicitly intended.

**Step result:** PENDING — live environment reconciliation required.

## 11. Security / secrets

- [x] Repository contract says secrets must not be committed.
- [x] TMS Web client secret is server-side.
- [x] Auth0 Deploy CLI contract uses a dedicated M2M application.
- [x] Supplied evidence contains no access token, cookie or full connection string.
- [ ] Audit Git history for exposed secrets.
- [ ] Audit Vercel environment variables.
- [ ] Audit Railway environment variables.
- [ ] Rotate any credential that has been exposed outside secret storage.
- [ ] Verify no secrets/tokens/cookies are included in audit evidence.

**Step result:** PARTIAL — the supplied runtime evidence is safe at the content level; the broader historical secret-exposure and rotation audit remains pending.

## 12. Production smoke test

- [x] Authenticated Production runtime path.
- [x] Access-token-backed tenant identity is evidenced.
- [~] Same-tenant operation/visibility is evidenced by the probe.
- [~] Cross-tenant isolation is evidenced by the probe.
- [ ] Fresh login callback evidence.
- [ ] Session establishment evidence from login through callback.
- [ ] Server-side access token acquisition endpoint evidence.
- [ ] Protected API endpoint response evidence.
- [ ] Membership resolution evidence.
- [ ] PostgreSQL tenant context evidence.
- [ ] Cross-tenant write denial.
- [ ] Logout succeeds.
- [ ] Re-login succeeds.

**Step result:** PARTIAL — authentication and tenant-isolation behavior are evidenced, but the full smoke test sequence is not closed.

## 13. AUTH-01 closure gate

AUTH-01 may be marked CLOSED only when all are proven:

- [ ] Live Action/version identified.
- [ ] Live Post-Login binding identified.
- [ ] Source/live diff resolved.
- [~] Fresh Production runtime tenant claim verified.
- [ ] Test user's Auth0 `app_metadata.tenant_id` verified directly.
- [ ] API membership verification verified.
- [~] Tenant-scoped DB visibility/isolation probe verified.
- [ ] Negative tenant authorization suite verified.
- [x] No secrets/tokens persisted in the supplied evidence.

**Current status:** [!] OPEN / P0.

## 14. Final production promotion gate

Do not promote/declare Production validated until:

- [ ] DB-04 closed.
- [ ] AUTH-01 closed.
- [ ] AUTH-02 environment reconciliation closed.
- [ ] Production smoke test passed.
- [ ] Security/secrets audit closed.
- [ ] Rollback configuration captured safely.
- [ ] Final evidence committed to `docs/audit/`.
- [ ] Deployment commit identified.
- [ ] Production deployment verified after promotion.

### 2026-09-28 — DB-04 diagnostic surface revalidated

- Re-read the Production diagnostic endpoints in `apps/api/src/modules/freight/freight.controller.ts`.
- `GET /freights/runtime-db-context` is protected by `AuthGuard` + `ops:diagnostics` and executes its query inside `withTenantContext`; it exposes the effective tenant setting and row count without exposing database credentials.
- `GET /freights/runtime-rls-isolation` is protected by the same guards and performs a tenant-scoped **SELECT-only** probe: it reads one freight under tenant A, switches the transaction-local `app.tenant_id` to a synthetic tenant B, and verifies that the same freight is hidden.
- The endpoint does **not** test cross-tenant INSERT/UPDATE/DELETE, missing-context denial, rollback/no-persistence, or role-bypass resistance. It therefore cannot by itself close DB-04.
- The Web route `/api/tms/runtime-context` uses the Auth0 server-side fetcher to call the protected RLS endpoint, so an authenticated browser session can exercise the probe without exposing a token to client code. The connected GitHub/Vercel tooling in this session does not provide that user's browser session for an authenticated invocation.
- No application code, AuthGuard, RLS policy, grant, role, credential or Production data was changed.

**Step result:** PARTIAL — the existing diagnostic surface is sufficient to prove tenant-scoped SELECT isolation when invoked with a real authenticated session, but the complete DB-04 behavioral suite still requires a restricted `tms_app` session and controlled write/rollback assertions.


### 2026-09-28 — DB-04 CI matrix reviewed; Production execution boundary confirmed

- Re-read `.github/workflows/ci.yml` and `packages/database/test/rls-runtime.integration.test.ts` references in the audit trail.
- CI provisions a dedicated non-bypass `tms_app` runtime role with a generated ephemeral password and runs the RLS integration suite through the restricted runtime connection, while the administrative connection is kept separate for fixtures/cleanup.
- The recorded successful CI run #1259 / 36240857560 covers cross-tenant SELECT, INSERT, UPDATE, DELETE and tenant-context isolation. This is strong evidence that the RLS contract is implemented and continuously tested with a non-bypass role.
- The CI PostgreSQL instance is an ephemeral runner service, not the Neon Production database. Its success therefore cannot be promoted to Production DB-04 evidence.
- No existing connected GitHub tool can dispatch a new workflow from this session, and no safe authenticated Production `tms_app` credential is exposed to the connector. No attempt was made to substitute `neondb_owner`, inject credentials, or create a Production test credential.

**Step result:** VERIFIED/BOUNDARY — the complete behavioral matrix exists and passes in CI with `tms_app`; Production E4 remains the only missing execution environment for DB-04. The correct next action is a controlled execution against the real Production runtime connection, preserving rollback/no-persistence and safe evidence only.


### 2026-09-28 — Production DB-04 execution-path inventory

- Re-read the versioned GitHub Actions workflows on `main` to identify an existing controlled path capable of executing Production database checks.
- `.github/workflows/database-migrate.yml` is protected by the `production` environment and has `workflow_dispatch`, but its purpose is migrations only; it does not execute the DB-04 behavioral suite.
- `.github/workflows/ci.yml` executes `packages/database/test/rls-runtime.integration.test.ts` with a generated non-bypass `tms_app` runtime credential, but its PostgreSQL target is an ephemeral GitHub Actions service, not Neon Production.
- The DB-04 integration test itself requires separate `DATABASE_ADMIN_URL` and `RUNTIME_DATABASE_URL` values, creates isolated temporary tenant/fixture rows through the admin connection, runs restricted-role assertions, and cleans up after completion.
- The connected GitHub tool surface still has no workflow-dispatch operation. Therefore no Production DB-04 run was triggered from this session, and no Production credential was created, rotated, substituted, or exposed.
- This inventory confirms that the repository already has the correct test implementation and a protected workflow pattern, but there is currently no executable connected path from this session to run that suite against Neon Production.

**Step result:** VERIFIED/BOUNDARY — implementation and non-Production execution path are present; Production DB-04 E4 remains pending until the suite is executed with the real restricted Production runtime connection and safe administrative fixture access.


---

## Change log

### 2026-09-28 — DB-04 runtime identity proof via Production `/ready`

- Production API project `tms-core-api` was resolved in Vercel and the live Production `GET /ready` endpoint was invoked at 07:50:29Z.
- The response was HTTP 200 `{"status":"ready","service":"tms-api"}`.
- Source review confirms `/ready` executes `select current_user` on the API database pool and returns readiness only when `current_user === "tms_app"`; otherwise it returns service unavailable.
- Vercel runtime logs independently recorded the same Production `GET /ready` request as HTTP 200 on deployment `dpl_8k2m41GzpeFURSBZvhd8RABdQSht` (main).
- This closes the **runtime identity** portion of DB-04: Production API runtime reached PostgreSQL as `tms_app` at the observed request.
- It does **not** by itself close the full DB-04 behavioral suite. Cross-tenant SELECT/INSERT/UPDATE, rollback/no-persistence and complete RLS evidence remain required.
- No secrets, tokens, connection strings, roles, grants, policies or application code were changed.


### 2026-09-28 — DB-04 runtime-role source/control verification

- Re-read the Production Railway service contract and current worker source.
- `apps/worker/src/main.ts` contains a startup guard that executes `select current_user` and fails startup unless the runtime role is exactly `tms_app`; on success it emits `database.runtime_role_verified`.
- The Production Railway service is still configured from `alexoaraujo83/TMS` / `main`, with `node apps/worker/dist/main.js` as the start command and `DATABASE_URL` defined.
- Read-only inspection of the successful Production deployment logs did not retrieve the `database.runtime_role_verified` event, so source-level enforcement cannot be promoted to runtime proof.
- Neon PostgreSQL telemetry is not enabled for the Production region, so it cannot provide an independent session-role trace.
- DB-04 therefore remains P0/open. No Railway variable, deployment, database role, RLS policy or grant was changed.


### 2026-09-28 — Auth0 read-only export execution path rechecked

- Re-read `.github/workflows/auth0-production-deploy-export.yml` on `main`.
- Confirmed the workflow is explicitly `workflow_dispatch` only, uses the protected `production-auth0-readonly` environment, dedicated Deploy CLI credentials, excludes client/connection secrets from exports, performs an Auth0 Deploy CLI **export only**, compares the export with the source contract, and publishes short-retention evidence.
- Re-checked the connected GitHub Actions tool surface: it exposes run/job/artifact retrieval but no workflow-dispatch operation. No Auth0 Production export was therefore triggered or fabricated from this session.
- AUTH-01 remains P0/open until an actual read-only Production export artifact is retrieved and reconciled. No Auth0 configuration mutation was performed.


### 2026-09-28 — Railway Production runtime log inspection

- Read-only Railway inspection of the current Production `tms-worker` deployment returned SUCCESS and continuous `durable_job.telemetry` events during the deployment's runtime window.
- The logs confirm the Production worker is actively executing with the expected tenant context and no deployment/runtime failure was observed in the inspected window.
- These logs do **not** expose or prove the PostgreSQL session role, `current_user`, `rolbypassrls`, or the DB-04 behavioral assertions.
- Therefore this step strengthens Production worker runtime evidence but does not close DB-04. No deployment, variable, SQL, RLS, grant or AuthGuard mutation was performed.
- Remaining DB-04 requirement: obtain a safe runtime proof that the actual restricted database session is `tms_app`, then execute the complete behavioral suite.


### 2026-09-28 — Vercel Production deployment reconciliation

- Read-only Vercel inspection confirmed the `tms-web` Production deployment for `main` is READY and points to the latest checklist commit `a1ee105e...`.
- The prior Production deployment from the DB-04 checklist commit was superseded; no rollback or deployment mutation was performed.
- This verifies deployment propagation only; Vercel Production/Preview/Development environment-variable values still require reconciliation.


### 2026-09-28 — Railway Production worker variable contract checked

- Read-only inspection of the Production `tms-worker` environment confirmed the expected runtime variable names are present, including `DATABASE_URL`, `APP_ENV` and `NODE_ENV`.
- Variable values were withheld/redacted and were not written to audit evidence.
- This confirms variable presence, not that the runtime database session is `tms_app`; DB-04 therefore remains open.


### 2026-09-28 — Production Neon target identified; restricted-session gate preserved

- Identified the versioned Production Neon project as `tms / shiny-hall-34679912` and its primary `main` branch read-only.
- Verified the connector reached the primary branch, but the SQL session is `neondb_owner`, not `tms_app`.
- Verified `tms_app` has login capability and `rolbypassrls=false`; verified `neondb_owner` has `rolbypassrls=true`.
- Verified the `neondb_owner → tms_app` membership has `set_option=false`, so `SET ROLE tms_app` is not a valid substitute for a real restricted session.
- No Production data mutation was executed; no RLS policy, grant, AuthGuard or tenant authorization behavior was changed.
- DB-04 remains P0/open until a real `tms_app` runtime session can execute the required behavioral tests.


### 2026-09-28 — DB-04 CI provenance reconciliation

- Re-checked CI run #651 and its quality job.
- Confirmed the security integration suite was enabled with the integration flag and separate admin/runtime variables.
- Confirmed the runtime database URL in that run targeted the ephemeral GitHub Actions PostgreSQL service.
- Therefore CI success does not close Production DB-04.
- No Production SQL mutation was executed and no AuthGuard, RLS policy or grant was weakened.


### 2026-09-28 — Authenticated Production + tenant-isolation runtime evidence

Evidence supplied for the controlled Production session shows:
- `authenticated=true`.
- Auth0 issuer is the Production tenant issuer.
- Audience includes `urn:tms:api:production` and the Auth0 userinfo audience.
- A concrete Auth0 subject is present.
- A concrete tenant ID is present in the authenticated runtime context.
- The tenant-isolation probe reports tenant A visible and synthetic tenant B not visible.
- The probe reports `rlsIsolation=true`.
- The identity payload contains the same Auth0 subject and the user's profile email/name fields.
- The evidence does not include a raw token or cookie.

Checklist impact:
- Live issuer/audience/subject/tenant runtime evidence moved from pending to verified.
- Tenant-A visibility and synthetic tenant-B isolation moved to partial DB-04 evidence.
- Full DB-04 remains open because the supplied bundle does not prove cross-tenant writes, missing tenant context denial, role-bypass resistance, or a recorded real `tms_app` session.
- AUTH-01 remains open because live Action/binding/Connection configuration and direct Auth0 `app_metadata.tenant_id` evidence are still absent.
- No Auth0 mutation is authorized by this evidence alone.

Next operational step:
1. Preserve this runtime evidence as safe audit evidence without storing tokens/cookies.
2. Capture the remaining DB-04 behavioral tests, especially cross-tenant write, missing tenant context, and role-bypass resistance.
3. In parallel, obtain the read-only Auth0 Production export to prove the live Action/binding/Connection configuration.


## 14. Reconciliation — 2026-10-08 — DB-04 closure, AUTH-01 remains open

The Production restricted-role evidence closed DB-04 with 6/6 checks PASS. This checklist now treats RLS behavioral isolation as closed and keeps the independent Auth0 live-configuration gate open.

**AUTH-01 remains OPEN / P0** until the read-only Production Auth0 export and comparison are executed and reviewed. The versioned workflow `.github/workflows/auth0-production-deploy-export.yml` is intentionally read-only and must be manually dispatched from GitHub Actions using the protected `production-auth0-readonly` environment. The connected tool surface in this session does not expose a workflow-dispatch operation, so no run is claimed and no Auth0 configuration has been changed.

Required next evidence from the run:
- workflow run URL and conclusion;
- artifact `auth0-production-export-evidence` from that run;
- comparison result for live Post-Login Action source, trigger version and binding against the versioned contract;
- live TMS Web application URI/connection evidence, if included in the export;
- a short sanitized summary of any missing or divergent resources, with secrets excluded.

If the workflow fails at Client Credentials authentication, follow `infra/auth0/DEPLOY-CLI-PRODUCTION.md` to verify the dedicated Deploy CLI M2M application, its grant type and Management API authorization. Do not enable Client Credentials on the TMS Web client, and do not run import/update/create/delete.
