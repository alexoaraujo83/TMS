# TMS — Database Documentation

## 1. Database role in the system

PostgreSQL is the transactional source of truth. The repository uses the `pg` driver, versioned forward-only SQL migrations, tenant-aware transactions and repositories. The database boundary is responsible for persistence, constraints, RLS, lifecycle invariants, audit persistence and durable asynchronous state.

The canonical database is independent from the reference Nexora project. No Nexora operational database is reused.

## 2. Current schema state

The repository currently contains **35 ordered migrations**, from `0001_foundation.sql` through `0035_diagnostics_permission_and_admin_replay.sql`. CI proves that the complete migration chain applies to a fresh PostgreSQL 17 database before the quality chain proceeds.

The migration sequence is:

| Migration | Capability |
|---|---|
| 0001 | Foundation: tenants, users, memberships and initial tenant security |
| 0002 | Freight operations: carriers, drivers, vehicles and freights |
| 0003 | IAM: roles, permissions and role mappings |
| 0004 | IAM bootstrap |
| 0005 | RLS hardening |
| 0006 | Authoritative membership/permission resolution |
| 0007 | Freight matching requirements |
| 0008 | Audit events |
| 0009 | Membership bootstrap grant |
| 0010 | Same-tenant master-data relationship hardening |
| 0011 | Matching assignments and assignment permissions |
| 0012 | Database-authoritative `updated_at` triggers |
| 0013 | Trip operations |
| 0014 | Trip permissions |
| 0015 | Trip cancellation invariants |
| 0016 | IAM role bootstrap |
| 0017 | Trip cancelled-constraint correction |
| 0018 | Compliance and GR foundation |
| 0019 | IAM operator/compliance permissions |
| 0020 | Auth0 subject identity and authoritative membership lookup |
| 0021 | Canonical schema reconciliation |
| 0022 | Trip execution: occurrences and POD |
| 0023 | Finance foundation |
| 0024 | Finance permissions |
| 0025 | Financial-entry immutability and lifecycle rules |
| 0026 | Outbox foundation |
| 0027 | Outbox lease tokens |
| 0028 | Durable Jobs |
| 0029 | Non-superuser/non-`BYPASSRLS` runtime role `tms_app` |
| 0030 | Compliance/GR assignment-to-freight composite invariant |
| 0031 | Finance assignment/trip-to-freight composite invariants |
| 0032 | Observability audit context metadata |
| 0033 | Durable Job idempotency |
| 0034 | Dedicated freight replay permission |
| 0035 | Operational diagnostics permission and admin replay grant |

## 3. Core entity catalogue

| Area | Tables / persisted aggregates | Isolation / integrity |
|---|---|---|
| Platform | `tenants` | tenant root, unique slug, status checks, RLS |
| IAM | `users`, `tenant_memberships`, `roles`, `permissions`, `role_permissions` | membership/role relationships, RLS on tenant-owned records |
| Master Data | `carriers`, `drivers`, `vehicles` | same-tenant composite FKs, unique tenant/document/RNTRC/plate constraints, RLS |
| Freight | `freights`, `freight_assignments` | lifecycle checks, tenant composite FKs, active-assignment uniqueness, RLS |
| Trip Operations | `trips`, `trip_occurrences`, `trip_pods` | tenant composite FKs, lifecycle/timestamp checks, RLS |
| Compliance | `compliance_checks`, `gr_requests` | tenant composite FKs, status/timestamp invariants, RLS |
| Finance | `financial_entries` | tenant composite FKs, amount/currency checks, external-reference uniqueness, immutability trigger, RLS |
| Reliability | `outbox_events`, `durable_jobs` | tenant isolation, indexes for claim/lease processing, RLS |
| Audit | `audit_events` | tenant-scoped immutable operational/security history, RLS |
| Migration metadata | `schema_migrations` | migration bookkeeping; not application business data |

## 4. Freight lifecycle

`freights.status` is constrained to:

`draft -> open -> matching -> negotiating -> assigned -> in_transit -> delivered`

with cancellation available at the explicitly supported lifecycle states. The application and database enforce the permitted transitions; worker handlers must use the same domain invariants rather than introducing a parallel lifecycle.

Freight records include tenant ownership, route, cargo, quantity/weight, optional volume and linear meters, prices in cents, BRL currency, collection/delivery windows and matching requirements such as vehicle/body types, minimum free meters and minimum capacity.

## 5. Assignment invariants

`freight_assignments` uses tenant-scoped composite foreign keys for freight, driver and vehicle. At most one active assignment is allowed per freight, driver and vehicle within a tenant.

Lifecycle invariants are:

- `active`: `completed_at` and `cancelled_at` are null;
- `completed`: `completed_at` is set and `cancelled_at` is null;
- `cancelled`: `cancelled_at` is set and `completed_at` is null.

Matching treats an active assignment as resource occupancy. Candidate discovery therefore cannot offer an already-occupied driver or vehicle merely because its master-data status says `available`.

Freight terminal transitions are synchronized with assignment state in the same transaction:

- `delivered` requires an active assignment and completes it;
- `cancelled` cancels any active assignment;
- assignment audit events are written in the same transaction;
- a synchronization failure rolls back the complete status transition.

## 6. Trip execution

`trips` belong to a tenant and reference freight and assignment through composite tenant-scoped foreign keys. Trip lifecycle is constrained to `planned`, `in_transit`, `delivered` and `cancelled`, with timestamp checks matching the lifecycle state.

`trip_occurrences` records operational exceptions such as delay, accident, breakdown, cargo damage, refusal and address issue, with severity and occurrence timestamp.

`trip_pods` records proof-of-delivery metadata and is unique per tenant/trip.

## 7. Compliance and GR

`compliance_checks` tracks compliance/risk checks with `pending`, `approved`, `rejected` and `expired` states. `gr_requests` tracks GR requests through `pending`, `submitted`, `approved`, `rejected`, `expired` and `cancelled`, with timestamp constraints tied to each state.

Both domains use tenant-scoped composite relationships to freight and assignment and are protected by RLS.

## 8. Finance

`financial_entries` stores tenant-scoped receivable/payable entries related to freight and optionally assignment/trip. Amounts are integer cents and currency is constrained to an uppercase three-character value, currently defaulting to `BRL`.

Financial status is `pending`, `settled` or `cancelled`. External references are unique within a tenant. After an entry leaves `pending`, the database trigger prevents mutation of material financial fields. Valid lifecycle transitions require `settled_at` for settlement and forbid it for cancellation.

Finance is therefore not treated as an ordinary mutable CRUD table; the database itself protects financial immutability rules.

## 9. Outbox and Durable Jobs

`outbox_events` persists asynchronous events with tenant, aggregate, event type, payload, status, attempts, availability and publication timestamps. Lease tokens prevent stale workers from finalizing a newer claim.

`durable_jobs` persists asynchronous work with tenant, job type, JSON payload, status, retry counters, availability, lease token, last error and completion timestamp. Pending and running indexes support efficient claim/reclaim operations.

The intended asynchronous boundary is:

`committed transaction -> outbox -> worker claim -> idempotent handler -> external side effect -> completion/failure -> audit`

Long-running Durable Jobs require lease heartbeat/renewal. The current hardening work is tracked separately until CI and integration evidence prove the behavior.

## 10. Tenant isolation and RLS

Tenant-scoped tables carry `tenant_id`. Critical tables enable and force RLS. Policies compare the row tenant with the transaction-local `app.tenant_id` setting.

The application database layer exposes tenant-aware transaction helpers so the tenant context is established inside the transaction rather than relying on a global connection setting.

Relationship hardening is explicit: drivers can reference only same-tenant carriers; vehicles only same-tenant drivers; assignments only same-tenant freight/driver/vehicle; trips only same-tenant freight/assignment; compliance and finance records only same-tenant parent records.

## 11. Runtime database role

Migration `0029_runtime_app_role.sql` defines the intended application runtime role as `tms_app` with:

- `LOGIN`;
- `NOSUPERUSER`;
- `NOCREATEDB`;
- `NOCREATEROLE`;
- `NOINHERIT`;
- `NOREPLICATION`;
- `NOBYPASSRLS`;
- no schema `CREATE` privilege;
- application DML privileges on business tables;
- no write privileges on `permissions` or `schema_migrations`;
- execution privilege on `check_tenant_membership(text, uuid)`.

The password is deliberately provisioned outside migrations. CI provisions an ephemeral runtime credential and runs the quality chain against the runtime role.

## 12. IAM database boundary

The authoritative membership resolver is based on the authenticated identity subject and tenant. Membership status and effective permissions are resolved from PostgreSQL rather than trusting client-provided roles.

The Auth0 subject is mapped to the local user identity. Tenant membership, active state and effective permissions remain TMS/PostgreSQL authority.

## 13. Timestamp integrity

Mutable tables with `updated_at` use database triggers. This makes timestamp maintenance authoritative at the database boundary rather than dependent on individual repository code paths.

## 14. Migration and release policy

Migrations are forward-only by default. Production schema changes should use expand/contract when multiple application versions may coexist during deployment.

A migration is not considered operationally proven because its file exists. CI must apply the migration chain to a real PostgreSQL instance. Production promotion additionally requires the relevant security, application, worker, backup/restore and deployment evidence.

## 15. Recovery requirements

The external PostgreSQL backup worker is the current backup mechanism. The intended chain is:

`PostgreSQL/Neon -> scheduled backup worker -> compressed/encrypted dump -> S3-compatible storage -> checksum/manifest verification -> retention -> isolated restore drill`.

An isolated restore-proof branch has now been reconciled from 0028 to the current 0031 schema and validated for the 0030/0031 relationship invariants. This proves schema-level DR reconciliation. Independent restoration from the current encrypted backup artifact and runtime backup execution remain operational gates.
