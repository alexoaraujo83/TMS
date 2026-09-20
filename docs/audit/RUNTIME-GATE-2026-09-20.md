# RUNTIME GATE — 2026-09-20

## Controller state

- Gate: Runtime
- Repository: `alexoaraujo83/TMS`
- Evidence branch: `audit/chat-07-technical-diagrams`
- Current main application commit: `675fbaaf11081c721b0a6d9ad0beebca14056353`
- Prior CI gate: COMPROVADO / PASS — E2 (CI #973 / run 35481688205)
- Runtime gate result: **PARTIAL — authenticated E2E still pending**

## Evidence verified

### TMS Core API

Vercel project: `tms-core-api`.

Production alias observed:
- `https://tms-api-snowy.vercel.app`

Reachability tests on 2026-09-20:
- `GET /health` → HTTP 200, `{"status":"ok","service":"tms-api"}`
- `GET /ready` → HTTP 200, `{"status":"ready","service":"tms-api"}`
- `GET /freights` without Authorization → HTTP 401, `Authentication required`

This proves the deployed API is reachable and the protected freight route fails closed when no Bearer token is supplied.

The inspected production API deployment:
- deployment: `dpl_51exFfBpbsvzdtMPiusZ7nj8TfSs`
- target: production
- commit: `30d0e015e6d1a305ed5c7e4b77199798041def14`

Runtime error aggregation for the API showed only a PostgreSQL SSL-mode deprecation warning in the inspected 24-hour window; no application error cluster was observed.

**Freshness caveat:** this production deployment is not the current main commit `675fbaaf...`. Production freshness therefore remains an open environment/deployment-parity item.

### TMS Web — production

Vercel project: `tms-web`.

The latest inspected READY production deployment is:
- deployment: `dpl_8Kzu664D92GAF9HqyemY7jN8k7qi`
- target: production
- commit: `1e9238304b064ae1f00399bb3cbc579216d4a886`
- aliases include `tms-web-chi.vercel.app`

The current Auth0 SDK source contract on main includes:
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- `AUTH0_AUDIENCE`
- `NEXT_PUBLIC_API_BASE_URL`

`apps/web/src/lib/auth0.ts` uses `Auth0Client` from `@auth0/nextjs-auth0/server` and explicitly disables the client-facing access-token endpoint.

Production runtime tests on `tms-web-chi.vercel.app`:
- `GET /` → HTTP 200; TMS page renders with Auth0 login entry point.
- `GET /api/auth/login` → HTTP 307 to Auth0 Authorization Code + PKCE authorization endpoint, with the production audience `urn:tms:api:production`.
- `GET /api/tms/freights` without an authenticated session → HTTP 401, `Authentication required`.

This is positive runtime evidence for the production Auth0 login initiation and BFF protection.

### Preview/non-production Auth0 failures

The Vercel project-level runtime error aggregation also contains Auth0 configuration failures from non-production deployments, including:
- `AUTH0_ISSUER_BASE_URL is not configured` on `/api/auth/login`
- missing `AUTH0_DOMAIN`
- missing `AUTH0_CLIENT_ID`, `AUTH0_SECRET`, and client-authentication configuration

These failures were associated with inspected preview deployments such as `dpl_CgkoZ72AcETJxZBPZzSpoDQka8BM` and `dpl_DXXkuAqP9WeKpu9Bf8dYJpFDvhhX`. They must **not** be treated as proof that the current production deployment has the same configuration.

They remain relevant to **BLK-001 Environment drift** because preview configuration is not demonstrably aligned with the production/runtime contract.

## Deployment freshness finding

Recent READY Vercel deployments were created from the audit branch and therefore do not establish production deployment of the current main commit.

Latest inspected audit-branch deployments:
- `tms-core-api`: `dpl_7o52yhbscScimwYaaRv9CG1eD9uX`, commit `6c8dbfcbdf71d497bbe300b08ac819bd9b16e00b`, READY, non-production.
- `tms-web`: `dpl_55ACxvemDY8KznNmRfPbavxGUwta`, commit `6c8dbfcbdf71d497bbe300b08ac819bd9b16e00b`, READY, non-production.

Therefore deployment existence must not be confused with production freshness.

## Gate classification

| Area | Result | Evidence |
|---|---|---|
| API public reachability | COMPROVADO | /health HTTP 200 |
| API readiness endpoint | COMPROVADO | /ready HTTP 200 |
| API protected-route fail-closed | COMPROVADO | /freights HTTP 401 without token |
| API production deployment | COMPROVADO | Vercel production deployment metadata |
| API production freshness vs current main | NÃO COMPROVADO | inspected production SHA differs from current main |
| Web production reachability | COMPROVADO | / HTTP 200 |
| Web Auth0 login initiation | COMPROVADO | /api/auth/login → Auth0 307 with PKCE |
| Web BFF protected route | COMPROVADO | /api/tms/freights → HTTP 401 without session |
| Web production freshness vs current main | NÃO COMPROVADO | inspected production SHA is `1e923830...`, current main is `675fbaaf...` |
| Preview environment parity | BLOCKER | Auth0 runtime errors in preview deployments |
| Auth0 callback/session completion | NÃO VALIDADO | no browser callback/session evidence captured |
| Real Auth0 access token reaching API | NÃO VALIDADO | no authenticated production API request completed |
| Tenant claim / membership / RBAC in production | NÃO VALIDADO | no real authenticated request completed |
| E4 end-to-end runtime | PENDING | login initiation proven; callback → token → API → tenant/RBAC remains |

## Blocker routing

- **BLK-001 Environment drift — P1:** remains open. Production is functional, but preview/runtime parity is not proven.
- **BLK-004 Runtime application coverage — P1:** remains open pending authenticated production request.
- **BLK-008 / AUTH0-REAL-TOKEN-01 — P1:** remains open pending real token and API validation.
- **BLK-005 Functional traceability — P1:** remains open until authenticated E2E is proven.
- **BLK-002 Worker deployment freshness / tenant lifecycle — P1:** unchanged.
- **BLK-003 Backup/DR readiness — P1:** unchanged.

## Required corrective/validation sequence

1. Keep production Auth0 configuration unchanged unless a concrete mismatch is demonstrated; current production login initiation is functioning.
2. Reconcile preview/staging Auth0 variables with the documented runtime contract without exposing secret values.
3. Deploy the current main commit to production only after environment parity is verified.
4. Execute the full browser/session flow: login → Auth0 callback → session → server-side `getAccessToken()`.
5. Call `/api/tms/freights` with the resulting session and confirm the BFF forwards the Auth0 access token.
6. Confirm the API validates issuer, audience, signature, expiry, tenant claim, active membership, tenant context and RBAC.
7. Capture E2/E3/E4 evidence and update the blocker ledger.
8. Then route to Worker/Outbox, Backup/DR and final regression gates.

## Important limitation

The connected Vercel toolset available to this audit can inspect projects, deployments and runtime logs, but it does not expose a safe environment-variable write operation. No secret or Auth0 credential was invented or written to source control. The environment-parity issue is therefore recorded rather than falsely marked corrected.
