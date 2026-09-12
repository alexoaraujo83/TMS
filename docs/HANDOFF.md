# TMS — Team Handoff

## Purpose

This document allows a new developer, QA engineer, designer or operations engineer to assume the project without relying on informal context.

## Development handoff

### Source of truth

The repository `alexoaraujo83/TMS` is the primary implementation. `alexoaraujo83/nexora-tms` is reference/audit material only. Do not copy runtime dependencies, databases, secrets or deployment state between them.

### First-day procedure

```bash
node --version
pnpm --version
pnpm doctor
pnpm bootstrap
pnpm validate
```

Read, in order:

1. `README.md`
2. `docs/architecture/FOUNDATION.md`
3. `docs/architecture/DOMAIN-MAP.md`
4. `docs/architecture/ROADMAP.md`
5. `docs/PROJECT-DOCUMENTATION.md`
6. `docs/DATABASE.md`
7. `docs/INTEGRATIONS-OPERATIONS.md`

### Current implementation focus

The strongest implemented area is tenancy/security/IAM plus freight, matching foundations and assignment persistence. Trip execution, compliance, finance, full reliability/outbox and analytics remain subsequent roadmap work.

### Rules

- Keep business rules out of the Web layer.
- Keep tenant context explicit and immutable for a request.
- Do not import another domain's private persistence implementation.
- Add database constraints for invariants that matter to integrity.
- Add negative cross-tenant tests for tenant-scoped capabilities.
- Update documentation with behavior changes.
- Material architecture changes require an ADR.

## Design -> development handoff

For every feature, provide:

- user/problem statement;
- actors and permissions;
- information architecture;
- happy path and alternate paths;
- wireframe or component composition;
- responsive breakpoints;
- accessibility requirements;
- all states: normal, hover, focus, loading, empty, error, success, disabled, forbidden and unavailable;
- exact data needed from API;
- mutation semantics and optimistic/pessimistic behavior;
- validation and error copy;
- analytics/audit requirements;
- acceptance criteria.

Frontend implementation must map each visual action to a real API/domain behavior or an explicitly documented non-functional interaction.

## Development -> QA handoff

QA should receive:

- changed files/modules;
- affected domain and API routes;
- migration numbers;
- permission changes;
- tenant-isolation implications;
- happy-path scenarios;
- validation failures;
- unauthorized/forbidden cases;
- cross-tenant negative cases;
- concurrency/idempotency cases where relevant;
- regression areas;
- expected observability/audit evidence.

### Minimum QA matrix

| Area | Verify |
|---|---|
| Authentication | unauthenticated request is rejected |
| Tenant isolation | tenant A cannot read/write tenant B data |
| Authorization | missing permission is forbidden |
| Validation | malformed UUID/body/window/value is rejected |
| Persistence | constraints and transaction behavior hold |
| Lifecycle | illegal state transitions fail |
| UI states | all required states render correctly |
| Errors | stable error semantics and no sensitive leakage |
| Audit | security/business changes produce required evidence |

## Development -> Operations handoff

Every deployable change must state:

- build artifact/commit;
- environment variables added/removed/changed;
- migration numbers and compatibility notes;
- required infrastructure;
- health checks;
- observability signals;
- rollback compatibility;
- feature flags if any;
- backup/restore implications;
- expected operational risks.

## Release gate

A feature is not complete merely because a page renders or an endpoint returns 200. The definition of done requires domain behavior, authorization, tenant isolation, constraints, API contract, tests, auditability where applicable, observability, documentation and CI success.
