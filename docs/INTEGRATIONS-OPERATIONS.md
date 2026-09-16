# TMS — Integrations & Operations

## 1. Runtime topology

```text
Browser
  -> Vercel / Next.js Web
      -> HTTP /api/v1
          -> NestJS API
              -> PostgreSQL / Neon

Worker -> PostgreSQL -> Outbox / Durable Jobs -> integration side effects
```

The intended hosting baseline is Vercel for Web, Railway for API/Worker and Neon PostgreSQL. The exact deployment wiring must be kept in platform configuration rather than committed secrets.

## 2. Environment contract

Relevant variables currently declared in `.env.example`:

- `NODE_ENV`
- `APP_ENV`
- `APP_NAME`
- `APP_URL`
- `API_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_SECRET`
- `LOG_LEVEL`

The example file is documentation only; it is not automatically loaded by the API. Secrets must come from the runtime secret store.

## 3. Authentication and authorization

JWT configuration exists through issuer, audience and secret settings. The API uses an authentication guard, current-user context, tenant guard and permission guard. Endpoint permissions are declared at the controller boundary with `RequirePermission`.

Authorization is tenant-aware and must remain enforced in application code plus database isolation. Never trust a tenant ID supplied by the browser without validating membership and establishing the server-side tenant context.

## 4. HTTP contract

Base path: `/api/v1`.

Health: `GET /health`.

Freight endpoints are documented in `docs/PROJECT-DOCUMENTATION.md`. Errors are normalized by the API error/HTTP exception infrastructure; clients should use HTTP status plus the stable application error payload rather than parsing human-readable text.

## 5. External services

### Neon PostgreSQL

Role: transactional persistence. Authentication is through `DATABASE_URL`. Tenant isolation is implemented with PostgreSQL RLS and the `app.tenant_id` setting.

### Vercel

Role: web runtime/deployment target. Authentication to Vercel is platform-managed; application secrets belong in the Vercel environment configuration.

### Railway

Role: intended API/worker runtime. Application startup must honor the injected `PORT`; the API's local fallback is 3001.

### Redis

`REDIS_URL` exists in the environment contract, but no production Redis-backed queue implementation is claimed by this baseline. Treat Redis as reserved infrastructure until a concrete adapter is implemented and tested.

### Business integrations

No external freight marketplace, carrier API, tracking provider, fiscal provider, payment provider or notification provider is documented as an implemented production connector in the inspected baseline. Do not create operational documentation that implies otherwise.

## 6. Events and asynchronous processing

The current baseline contains a transactional outbox processor and durable-job persistence/claiming paths. Outbox events are persisted transactionally and claimed with tenant-aware leasing/fencing. Durable jobs likewise use tenant-aware claiming, and recent hardening aligns claims with active tenant lifecycle. Worker lease renewal/acknowledgement behavior is protected by fencing and regression coverage.

The operational model is:

`committed transaction -> outbox/durable job -> worker claim -> idempotent handler -> external side effect -> completion/failure -> audit`

This does **not** imply that every future external integration is implemented. Receiver-side deduplication, complete replay tooling and business-specific handlers must be independently exercised and evidenced before being described as production-ready.

## 7. Deployment procedure

1. Verify repository state and required Node/pnpm versions.
2. Install with the committed lockfile.
3. Run formatting, lint, typecheck, tests and build.
4. Apply database migrations in the target environment.
5. Verify application health.
6. Verify tenant isolation and authorization smoke tests.
7. Verify worker/outbox/durable-job health where applicable.
8. Promote Web/API/Worker according to environment policy.
9. Record release commit and migration version.

Never deploy a populated `.env` file or production credentials through Git.

## 8. Rollback

Application rollback should first confirm database compatibility. Because migrations are forward-only by default, prefer rolling the application back only when the schema remains backward compatible. For incompatible changes, use expand/contract rather than destructive rollback SQL.

If data integrity is at risk, stop writes, preserve evidence/logs, identify the last known-good commit/schema, and execute the approved recovery procedure rather than attempting ad-hoc production edits.

## 9. Incident response

### P0 — security/data integrity

Immediately block promotion or isolate the affected path. Preserve request IDs, deployment SHA, database migration version and relevant audit events. Validate cross-tenant access, authorization bypass and transaction integrity before reopening traffic.

### P1 — major business degradation

Identify affected domain, reproduce with tenant-scoped test data, inspect API/worker logs and database health, mitigate through feature/path isolation where possible, then deploy a verified fix.

### P2/P3

Track through normal issue/maintenance workflow with owner, impact, reproduction, expected behavior and verification evidence.

## 10. Observability

All operational flows should carry a correlation/request ID. Audit events support actor, action, entity, request ID, before/after state and metadata. Production observability must make it possible to trace a request from HTTP boundary through use case, transaction and asynchronous side effect.

## 11. Maintenance

- Keep Node/pnpm versions aligned with the repository.
- Keep migrations immutable after release.
- Update docs in the same change as behavior.
- Review indexes when query patterns change.
- Run security and dependency checks before production promotion.
- Perform periodic backup/restore drills.
- Remove unused environment variables and integrations rather than leaving undocumented operational dependencies.
