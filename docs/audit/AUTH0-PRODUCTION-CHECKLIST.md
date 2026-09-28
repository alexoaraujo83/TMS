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
- [~] Behavioral RLS evidence now proves tenant-A visibility and synthetic tenant-B isolation for the supplied probe, but the complete DB-04 suite is not yet closed.
- [!] AUTH-01 E4 is still open.
- [!] DB-04 behavioral RLS proof remains a production gate.

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
- [~] Latest Production deployment is on `main` at commit `ac1997fd699dae5ee2c7a5c67794e115b2edddd3`; this proves the checklist commit is deployed, not that Production environment variables are correct.
- [~] Authenticated Production runtime path is proven by the supplied `authenticated: true` evidence.
- [ ] Verify no Preview/Development origin is used by Production.
- [ ] Verify protected API request succeeds with a valid token and record endpoint-level evidence.

**Step result:** PARTIAL — authenticated Production runtime is now evidenced; environment separation and endpoint-level API proof remain pending.

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
- [ ] Execute the complete six DB-04 behavioral isolation tests.
- [ ] Prove cross-tenant read denial independently.
- [ ] Prove cross-tenant write denial.
- [ ] Prove missing tenant context denial.
- [ ] Prove role cannot bypass RLS.
- [ ] Record only safe evidence.

**Step result:** BLOCKER/P0 — meaningful RLS isolation evidence is now present, including tenant-A visibility and synthetic tenant-B non-visibility, but DB-04 cannot close until the remaining behavioral tests and session evidence are captured.

## 10. Production environment separation

- [x] Development audience is distinct.
- [x] Staging audience is distinct.
- [x] Production audience is distinct.
- [ ] Verify Vercel Production variables.
- [ ] Verify Vercel Preview variables.
- [ ] Verify Vercel Development variables.
- [ ] Verify Railway Production API/worker variables.
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

---

## Change log

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
