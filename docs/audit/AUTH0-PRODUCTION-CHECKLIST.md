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

**Step result:** PENDING — live Auth0 inspection is required.

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

**Step result:** PARTIAL — code/config contract exists; live Auth0 application settings remain to be verified.

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
- [ ] Verify controlled test user has the intended `app_metadata.tenant_id`.
- [ ] Verify tenant UUID corresponds to an active TMS tenant.
- [ ] Verify corresponding local membership exists or first-login bootstrap is exercised.
- [ ] Do not persist the user's token/cookie in evidence.

**Step result:** PARTIAL — source behavior verified; live user metadata still requires controlled validation.

## 5. Auth0 API / token contract

- [x] Production audience is defined as `urn:tms:api:production`.
- [x] Development audience is separate.
- [x] Staging audience is separate.
- [x] API validates issuer.
- [x] API validates audience.
- [x] API uses JWKS.
- [x] API restricts JWT verification to RS256.
- [x] API requires `sub`.
- [ ] Verify live TMS API Production audience.
- [ ] Verify live issuer.
- [ ] Verify live JWKS endpoint.
- [ ] Verify fresh Production token contains the tenant claim.
- [ ] Verify token is accepted by Production API.

**Step result:** PARTIAL — implementation is verified; live Production token evidence is pending.

## 6. TMS Web → TMS API

- [x] TMS Web uses Auth0 SDK `createFetcher`.
- [x] Authenticated fetch uses `fetchWithAuth`.
- [x] `NEXT_PUBLIC_API_BASE_URL` is the configured API origin.
- [ ] Verify Production Web calls Production API.
- [ ] Verify no Preview/Development origin is used by Production.
- [ ] Verify fresh login reaches `/api/tms/auth-runtime`.
- [ ] Verify protected API request succeeds with a valid token.

**Step result:** PARTIAL — source path verified; deployed E2E remains pending.

## 7. Tenant authorization

- [x] Missing Authorization header is rejected.
- [x] Missing tenant claim is rejected.
- [x] `x-tenant-id` cannot override authenticated tenant claim.
- [x] API checks `sub + tenant` membership.
- [x] Inactive/missing membership is denied after bootstrap rules.
- [ ] Run controlled wrong-tenant header test.
- [ ] Run controlled missing-tenant-claim test.
- [ ] Run controlled inactive-membership test.
- [ ] Confirm no cross-tenant resource access.

**Step result:** PARTIAL — code path verified; negative runtime evidence is pending.

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

**Step result:** PARTIAL — implementation exists; runtime proof is pending.

## 9. PostgreSQL / RLS gate DB-04

- [x] Tenant context is part of the API request context.
- [x] Repository architecture installs tenant context transactionally.
- [x] RLS is documented as the final isolation boundary.
- [ ] Obtain a real `tms_app` session in Production.
- [ ] Execute the six DB-04 behavioral isolation tests.
- [ ] Prove same-tenant access.
- [ ] Prove cross-tenant read denial.
- [ ] Prove cross-tenant write denial.
- [ ] Prove missing tenant context denial.
- [ ] Prove role cannot bypass RLS.
- [ ] Record only safe evidence.

**Step result:** BLOCKER/P0 — DB-04 remains open.

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
- [ ] Audit Git history for exposed secrets.
- [ ] Audit Vercel environment variables.
- [ ] Audit Railway environment variables.
- [ ] Rotate any credential that has been exposed outside secret storage.
- [ ] Verify no secrets/tokens/cookies are included in audit evidence.

**Step result:** PENDING — secret exposure/rotation audit remains required.

## 12. Production smoke test

- [ ] Fresh login.
- [ ] Callback succeeds.
- [ ] Session established.
- [ ] Access token obtained server-side.
- [ ] Tenant claim present.
- [ ] API accepts token.
- [ ] Membership resolves.
- [ ] PostgreSQL tenant context is set.
- [ ] Same-tenant operation succeeds.
- [ ] Cross-tenant operation is denied.
- [ ] Logout succeeds.
- [ ] Re-login succeeds.

**Step result:** BLOCKED until live Auth0, API and DB evidence is available.

## 13. AUTH-01 closure gate

AUTH-01 may be marked CLOSED only when all are proven:

- [ ] Live Action/version identified.
- [ ] Live Post-Login binding identified.
- [ ] Source/live diff resolved.
- [ ] Test user's tenant metadata verified.
- [ ] Fresh token tenant claim verified.
- [ ] API membership verification verified.
- [ ] Tenant-scoped DB operation verified.
- [ ] Negative tenant test verified.
- [ ] No secrets/tokens persisted in repository or evidence.

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

### 2026-09-28 — Initial operational checklist

Verified against the current source-controlled TMS contract:
- Auth0 v4 Web SDK integration exists.
- Server-side Auth0 client exists.
- Access-token fetcher path exists.
- API JWT verification exists with issuer/audience/JWKS/RS256.
- Tenant claim namespace exists.
- Post-Login Action and binding are versioned.
- First-login identity bootstrap exists.
- Tenant membership is re-checked by the API.
- AUTH-01 remains P0/open.
- DB-04 remains P0/open.

Next operational step: **read-only reconciliation of live Auth0 Production Action, Post-Login binding, Connection → TMS Web, Production audience and controlled test-user tenant metadata.**
