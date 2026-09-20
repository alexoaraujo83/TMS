# RUNTIME GATE — 2026-09-20

## Controller state

- Gate: Runtime
- Repository: `alexoaraujo83/TMS`
- Evidence branch: `audit/chat-07-technical-diagrams`
- Current main application commit: `675fbaaf11081c721b0a6d9ad0beebca14056353`
- Prior CI gate: COMPROVADO / PASS — E2 (CI #973 / run 35481688205)
- Runtime gate result: **PARTIAL / BLOCKED**

## Evidence verified

### TMS Core API

Vercel project: `tms-core-api`.

Current production alias observed:
- `https://tms-api-snowy.vercel.app`

Reachability tests on 2026-09-20:
- `GET /health` → HTTP 200, `{"status":"ok","service":"tms-api"}`
- `GET /ready` → HTTP 200, `{"status":"ready","service":"tms-api"}`
- `GET /freights` without Authorization → HTTP 401, `Authentication required`

This proves the deployed API is reachable and the protected freight route fails closed when no Bearer token is supplied.

The latest observed production API deployment is:
- deployment: `dpl_51exFfBpbsvzdtMPiusZ7nj8TfSs`
- target: production
- commit: `30d0e015e6d1a305ed5c7e4b77199798041def14`

Runtime error aggregation for the API showed only a PostgreSQL SSL-mode deprecation warning in the inspected 24-hour window; no application error cluster was observed.

### TMS Web

Vercel project: `tms-web`.

The current Auth0 SDK source contract on main includes:
- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- `AUTH0_AUDIENCE`
- `NEXT_PUBLIC_API_BASE_URL`

`apps/web/src/lib/auth0.ts` uses `Auth0Client` from `@auth0/nextjs-auth0/server` and explicitly disables the client-facing access-token endpoint.

The production/preview runtime evidence is **not clean**:
- runtime error: `AUTH0_ISSUER_BASE_URL is not configured` on `/api/auth/login`
- runtime error: missing `AUTH0_DOMAIN`
- runtime warning: missing `AUTH0_CLIENT_ID`, `AUTH0_SECRET`, and client authentication configuration
- another runtime cluster reports Auth0 domain-resolution failure caused by missing `AUTH0_DOMAIN`

These are configuration/runtime failures, not CI/build failures.

## Deployment freshness finding

Recent READY Vercel deployments were created from the audit branch and therefore do not establish production deployment of the current main commit.

The latest inspected READY `tms-core-api` deployment from the audit branch:
- deployment: `dpl_7o52yhbscScimwYaaRv9CG1eD9uX`
- commit: `6c8dbfcbdf71d497bbe300b08ac819bd9b16e00b`
- state: READY
- target: preview/non-production

The latest inspected READY `tms-web` deployment from the audit branch:
- deployment: `dpl_55ACxvemDY8KznNmRfPbavxGUwta`
- commit: `6c8dbfcbdf71d497bbe300b08ac819bd9b16e00b`
- state: READY
- target: preview/non-production

Therefore, deployment existence must not be confused with production freshness.

## Gate classification

| Area | Result | Evidence |
|---|---|---|
| API public reachability | COMPROVADO | /health HTTP 200 |
| API readiness endpoint | COMPROVADO | /ready HTTP 200 |
| API protected-route fail-closed | COMPROVADO | /freights HTTP 401 without token |
| API current production deployment | COMPROVADO | Vercel production deployment metadata |
| Web Auth0 runtime configuration | QUEBRADO / BLOCKER | Missing Auth0 runtime variables in observed deployment |
| Web production freshness on current main | NÃO COMPROVADO | Recent READY deployments inspected are preview/audit branch |
| Real Auth0 browser login | NÃO VALIDADO | Login route currently fails due runtime configuration |
| Web → Auth0 → API with real access token | NÃO VALIDADO | Blocked before token acquisition |
| Tenant claim / membership / RBAC in production | NÃO VALIDADO | No real authenticated request completed |
| E4 end-to-end runtime | BLOCKED | Auth0 production configuration + fresh production deployment pending |

## Blocker routing

- **BLK-001 Environment drift — P1:** remains open.
- **BLK-004 Runtime application coverage — P1:** remains open.
- **BLK-008 / AUTH0-REAL-TOKEN-01 — P1:** remains open.
- **BLK-005 Functional traceability — P1:** remains open until authenticated E2E is proven.
- **BLK-002 Worker deployment freshness / tenant lifecycle — P1:** unchanged.
- **BLK-003 Backup/DR readiness — P1:** unchanged.

## Required corrective sequence

1. Configure the TMS Web production Auth0 variables in Vercel without exposing secret values:
   - `AUTH0_DOMAIN=tms-platform.us.auth0.com`
   - `AUTH0_CLIENT_ID=<configured Auth0 Regular Web Application client ID>`
   - `AUTH0_CLIENT_SECRET=<secret stored only in Vercel>`
   - `AUTH0_SECRET=<random 32+ byte session secret>`
   - `APP_BASE_URL=<canonical production TMS Web URL>`
   - `AUTH0_AUDIENCE=urn:tms:api:production`
   - `NEXT_PUBLIC_API_BASE_URL=<canonical production TMS API URL>`
2. Verify the API production environment contains the corresponding issuer/audience/JWKS contract without printing secret values.
3. Deploy the current main commit to production after configuration is verified.
4. Re-test Web root, `/api/auth/login`, Auth0 callback/session, and the server-side freight proxy.
5. Acquire a real Auth0 access token through the normal Web session flow; do not use a pasted/generated test JWT as proof of production E2E.
6. Call the protected API and prove issuer, audience, signature, expiry, tenant claim, active membership, tenant context, RBAC and response.
7. Capture E2/E3/E4 evidence and update the blocker ledger.

## Important limitation

The connected Vercel toolset available to this audit can inspect projects, deployments and runtime logs, but it does not expose a safe environment-variable write operation. No secret or Auth0 credential was invented or written to source control. The runtime blocker is therefore recorded rather than falsely marked corrected.

