# TMS — EVIDENCE LEDGER DELTA — 2026-09-17

Parent ledger: `docs/audit/EVIDENCE-LEDGER-2026-09-16.md`
Repository: `alexoaraujo83/TMS`
Branch: `main`

## New evidence

| ID | Stage/Gate | Claim | Evidence | Level | Status | Priority | Next action |
|---|---|---|---|---|---|---|---|
| EV-027 | CHAT 20 | Backend executable entrypoint and module graph exist | `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts` | E2 | IMPLEMENTED | P1 | Runtime route smoke |
| EV-028 | CHAT 21 | Freight API contract is implemented | `FreightController` exposes create/list/get/matches/assignment/status routes; global DTO validation is enabled | E2 | IMPLEMENTED | P1 | Authenticated runtime contract smoke |
| EV-029 | CHAT 22 | Backend authorization is fail-closed and tenant-scoped | `AuthGuard`, `PermissionGuard`, request context and tenant-scoped repositories | E2 | IMPLEMENTED | P1 | Execute protected positive/negative runtime tests |
| EV-030 | CHAT 23 | Typed frontend API client exists | `apps/web/src/lib/api.ts` on `main` | E2 | IMPLEMENTED | P1 | Deploy frontend and configure API origin |
| EV-031 | CHAT 24 | Frontend consumes API `/health` | `apps/web/src/app/page.tsx` calls typed client and exposes loading/success/error/retry | E3 | IMPLEMENTED / NOT DEPLOYMENT-VALIDATED | P1 | Prove browser → API in deployed web |
| EV-032 | CHAT 25 | Accessibility baseline exists for API-status surface | Semantic heading/status/alert controls and disabled refresh during loading | E1/E2 | PARTIAL | P2 | Rendered accessibility/responsive validation |

## P1 blockers carried forward

- **BLK-004 Runtime application coverage:** public health is evidenced, but protected route/permission/runtime smoke remains pending.
- **BLK-005 Functional traceability:** end-to-end requirement-to-operation mapping remains incomplete.
- **BLK-008 Frontend deployment/integration:** a separate production deployment for `apps/web` is not currently evidenced; `NEXT_PUBLIC_API_BASE_URL` is documented but not runtime-configured/validated in a web deployment.
- **BLK-009 Protected E2E:** authenticated browser/API E2E requires a valid test identity, tenant membership and permissions; no credential was used or persisted in this pass.

## Regression rule

Do not upgrade these items to E4 until:

`format → lint → typecheck → test → build → frontend deployment → browser smoke → authenticated API smoke → protected E2E`

## Current correction commits

- `c0d0209f8399a60474b81f92716ba2df1fccad38` — typed frontend API client.
- `bf66e93dac6f1d76fca6c895ac6d4a882428c312` — frontend consumes API health endpoint.
- `b082fc979fd667128b8af884fa3626360f72d92e` — API base URL contract documentation.
- `f2e72d9b70f056228a267e4c80ab8884389229cb` — CHAT 20–25 reconciliation evidence.

## Important non-claims

- No protected production E2E is claimed.
- No frontend production deployment is claimed.
- No authenticated business-route success is claimed.
- No new tenant or credential was invented/configured.
