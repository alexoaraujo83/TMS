# TMS — Project Documentation

**Status:** living technical baseline  
**Repository:** `alexoaraujo83/TMS`  
**Purpose:** document what is actually implemented, distinguish it from the target architecture, and make the project transferable between teams.

## 1. Executive summary

TMS is a new, independent Transportation Management System/SaaS. `alexoaraujo83/nexora-tms` is reference material only. The TMS repository explicitly forbids a runtime dependency, shared database, copied application boundary, or fork relationship with Nexora.

The implemented baseline is a TypeScript monorepo using pnpm/Turborepo with a Next.js web application, NestJS API, asynchronous worker, PostgreSQL/Neon persistence and shared packages. The current database migration history reaches `0028_durable_jobs.sql` and includes tenancy, IAM, master-data/freight foundations, audit events, assignments, Trip Operations, Compliance/GR, outbox events and durable jobs.

## 2. Repository topology

```text
apps/
  web/       Next.js application
  api/       NestJS HTTP API
  worker/    asynchronous worker and outbox processing
packages/
  database/  PostgreSQL access, transactions, repositories, migrations
  auth/      authentication primitives
  freight/   shared freight domain package
  matching/  shared matching contracts
  security/  security primitives
  config/    configuration
  contracts/ shared API/domain contracts
  observability/ logging/correlation contracts
scripts/     bootstrap/diagnostic/operational tooling
docs/        architecture, security, operations, handoffs and runbooks
```

The canonical architecture also defines Platform, IAM, Master Data, Freight, Matching, Trip Operations, Compliance, Finance, Reliability, Audit and Analytics as bounded contexts. Some of these are architectural targets rather than fully implemented runtime modules.

## 3. Runtime baseline

- Node.js 24.20.0
- pnpm 11.24.0
- TypeScript 6.0.3
- Turborepo 2.10.12
- Next.js 16.3.3
- React 19.2.8
- NestJS 12.0.1
- PostgreSQL/Neon
- `pg` 8.23.0
- `jose` 6.2.10

The root quality chain is formatting check, lint, typecheck, tests and build. CI uses the frozen pnpm lockfile and validates the same quality chain.

## 4. Implemented API surface

The API has operational `/health` and `/ready` endpoints and a versioned base path `/api/v1`. `/ready` performs a PostgreSQL `select 1` and returns service-unavailable when the database cannot be reached.

The freight controller currently exposes:

| Method | Route                             | Permission        | Purpose               |
| ------ | --------------------------------- | ----------------- | --------------------- |
| POST   | `/api/v1/freights`                | `freight:create`  | Create freight        |
| GET    | `/api/v1/freights`                | `freight:read`    | List freight          |
| GET    | `/api/v1/freights/:id`            | `freight:read`    | Get freight           |
| GET    | `/api/v1/freights/:id/matches`    | `matching:read`   | Rank candidates       |
| POST   | `/api/v1/freights/:id/assignment` | `matching:assign` | Assign driver/vehicle |
| PATCH  | `/api/v1/freights/:id/status`     | `freight:update`  | Change freight status |

Every freight endpoint is protected by authentication and permission guards. UUID route parameters are validated by NestJS pipes.

## 5. Implemented security model

Request processing is designed as:

`Authentication -> TenantContext -> Authorization -> Use Case -> Transaction -> Audit/Outbox -> Response`

Tenant isolation is implemented at the PostgreSQL boundary with `tenant_id`, RLS, forced RLS and the `app.tenant_id` session setting. IAM includes users, tenant memberships, roles, permissions and role-permission mappings. The membership bootstrap function resolves effective permissions for a selected user and tenant using a fixed `search_path` and `SECURITY DEFINER`.

Database hardening also prevents cross-tenant carrier/driver/vehicle relationships through composite foreign keys.

## 6. Implemented business data

The current schema includes tenancy/IAM, master data, freight, audit, assignment, Trip Operations, Compliance/GR, outbox events and durable jobs. Critical recovery validation has confirmed the presence of 21 public base tables and 28 applied migrations, with `0028_durable_jobs.sql` as the latest migration in the validated recovery branch.

Freight supports dedicated, shared, complement and urgent types; route, cargo, quantity, weight, volume, linear meters, commercial/driver prices, BRL currency, collection/delivery windows and matching requirements.

## 7. Lifecycle and assignment invariants

Freight status supports: `draft`, `open`, `matching`, `negotiating`, `assigned`, `in_transit`, `delivered`, `cancelled`.

Assignment status supports: `active`, `completed`, `cancelled`. Database checks enforce the timestamp associated with the terminal assignment state. Partial unique indexes ensure a tenant cannot have two active assignments for the same freight, driver or vehicle.

Trip Operations and Compliance/GR are implemented foundations with tenant-scoped persistence, RLS, explicit state transitions, transactional invariants, audit behavior and protected API surfaces.

## 8. Worker and Outbox reality

The worker is no longer only a bootstrap placeholder. The repository contains an outbox processor and persistence path with tenant context, pending-event claiming, `FOR UPDATE SKIP LOCKED`, lease tokens, publish/failure transitions and exponential retry delay capped at five minutes. Outbox events are persisted transactionally and protected by tenant RLS.

Webhook delivery is implemented as an event side effect with request timeout, redirect rejection, HMAC SHA-256 signing and event-based idempotency metadata. These mechanisms are implemented and tested, but production-grade receiver-side deduplication and a full replay workflow must not be inferred unless independently exercised and evidenced.

## 9. External integrations

The repository baseline identifies Vercel for web hosting, Neon for PostgreSQL and Railway as the intended API/worker runtime. Backup infrastructure also uses an S3-compatible object store. No business integration provider is documented as an implemented production connector in the inspected code baseline. Future integrations must be added as explicit adapters with authentication, idempotency, timeout/retry behavior, observability and contract tests.

## 10. Backup, restore and disaster recovery

Database backup is implemented through the Railway backup worker. The backup path produces an encrypted PostgreSQL dump, checksum and manifest and verifies the remote checksum before reporting a verified backup. The restore verification path checks the stored checksum, decrypts the dump and restores into an isolated target with Neon-managed objects excluded where necessary.

A real isolated Neon restore drill has been executed with `finalize: false`. The recovery branch reached `ready` and passed read-only structural validation, including PostgreSQL 17.11, database availability, 21 public base tables, 28 migrations and 10/10 critical TMS tables. This proves the restore mechanism and safe isolated drill.

Production disaster-recovery readiness remains **NOT PROVEN** because recurring backup policy, retention ownership, business-approved RPO and business-approved RTO are not yet established. The observed provider branch readiness time is not an application-level RTO.

See `docs/operations/BACKUP-RESTORE-DRILL.md` for the controlled procedure and evidence requirements.

## 11. Nexora relationship

Nexora has a mature engineering baseline including the same Node/pnpm/Turborepo family and executable Web/API/Worker topology. TMS intentionally takes the architectural lessons without sharing runtime state. The TMS foundation explicitly states this independence and makes tenant isolation, authorization, persistence, tests, observability and documentation part of Definition of Done.

## 12. Target vs implemented matrix

| Capability                     | Current status |
| ------------------------------ | -------------- |
| Monorepo/toolchain             | Implemented |
| Web/API/Worker deployables     | Implemented foundation; worker has outbox processing |
| PostgreSQL migrations          | Implemented through migration `0028_durable_jobs.sql` |
| Multi-tenancy                  | Implemented foundation |
| IAM/permissions                | Implemented foundation |
| Master data                    | Implemented foundation: carrier/driver/vehicle |
| Freight lifecycle              | Implemented foundation |
| Matching                       | Implemented foundation/ranking + assignment |
| Trip execution                 | Implemented foundation |
| Compliance/GR                  | Implemented foundation |
| Finance                        | Implemented foundation; broader product scope remains under validation |
| Transactional outbox           | Implemented and tested foundation |
| Webhook delivery               | Implemented and tested foundation |
| Durable jobs                   | Migration/persistence foundation implemented; broader runtime orchestration remains under validation |
| External business integrations | Not established as implemented production connectors |
| Analytics/AI                   | Architectural target |
| Backup/restore                 | Restore mechanism proven; recurring DR policy not proven |
| Production hardening           | Roadmap / gates still open |

## 13. Documentation rule

Whenever implementation changes, update the corresponding documentation in the same change. Never describe a planned module as production functionality. Architectural changes require an ADR.
