# TMS — Frontend Audit Baseline — 2026-09-16

## Scope

Audit `apps/web` against the documented product architecture and current repository implementation.

## Verified baseline

- Next.js web application exists under `apps/web`.
- The application has `src/app/layout.tsx`, `src/app/globals.css` and `src/app/page.tsx` in the inspected baseline.
- The home page is foundation-level and explicitly states that operational modules will be added incrementally.

## Current classification

| Capability | Status |
|---|---|
| Next.js application | IMPLEMENTED FOUNDATION |
| Root layout | IMPLEMENTED FOUNDATION |
| Global stylesheet | IMPLEMENTED FOUNDATION |
| Operational dashboard | NOT PROVEN |
| Authentication UI | NOT PROVEN |
| Tenant selection/context UI | NOT PROVEN |
| RBAC-aware navigation | NOT PROVEN |
| Freight screens | NOT PROVEN |
| Matching screens | NOT PROVEN |
| Assignment flow | NOT PROVEN |
| Trip operations UI | NOT PROVEN |
| Compliance/GR UI | NOT PROVEN |
| Finance UI | NOT PROVEN |
| Notifications | NOT PROVEN |
| Error/loading/empty states | NOT AUDITED |
| API client contract | NOT AUDITED |
| Frontend observability | NOT AUDITED |
| Accessibility | NOT AUDITED |
| Responsive behavior | NOT AUDITED |
| E2E coverage | NOT AUDITED |

## Reconciliation rule

Backend capability must not be represented as frontend capability. An API route, database table or domain module does not prove that an equivalent web workflow exists.

## Next frontend audit sequence

1. Enumerate every route, page, component and client/server boundary.
2. Inspect package dependencies and frontend scripts.
3. Identify API client and authentication integration.
4. Map UI permissions to backend permissions.
5. Map implemented backend domains to actual screens.
6. Audit loading, error, empty and authorization states.
7. Audit forms, validation and mutation flows.
8. Audit accessibility and responsive behavior.
9. Add/verify component and E2E tests where product behavior exists.
10. Update documentation only after implementation evidence exists.
