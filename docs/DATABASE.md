# TMS — Database Documentation

## Engine and access

PostgreSQL is the transactional source of truth. The project uses `pg`, a dedicated database package, versioned SQL migrations and tenant-aware transactions. The database package exports pool/transaction helpers, tenant context support and repositories for freight, carriers, drivers, vehicles, assignments and audit.

Current schema version: **11**.

## Entity catalogue

| Table                 | Key fields                                                                                                        | Relationships                           | Main constraints/indexes                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- |
| `tenants`             | id, name, slug, status, timestamps                                                                                | root tenant                             | PK id; unique slug; status CHECK; RLS                                              |
| `users`               | id, email, display_name, status, timestamps                                                                       | memberships                             | PK id; unique email; status CHECK; RLS                                             |
| `tenant_memberships`  | tenant_id, user_id, role, role_id, created_at                                                                     | tenant ↔ user ↔ role                    | composite PK; user/role indexes; RLS                                               |
| `roles`               | id, tenant_id, name, description, created_at                                                                      | tenant; role_permissions                | unique tenant/name; RLS                                                            |
| `permissions`         | id, code, description                                                                                             | role_permissions                        | unique code                                                                        |
| `role_permissions`    | role_id, permission_id                                                                                            | role ↔ permission                       | composite PK; permission index; RLS                                                |
| `carriers`            | id, tenant_id, legal_name, document_number, status, timestamps                                                    | tenant                                  | unique tenant/document; tenant/status index; RLS                                   |
| `drivers`             | id, tenant_id, carrier_id, name, document_number, phone, rntrc, antt_status, status, timestamps                   | tenant; optional carrier                | unique tenant/document; unique tenant/RNTRC; composite same-tenant carrier FK; RLS |
| `vehicles`            | id, tenant_id, driver_id, plate, vehicle_type, body_type, capacity_kg, free_meters, status, timestamps            | tenant; optional driver                 | unique tenant/plate; composite same-tenant driver FK; tenant/status index; RLS     |
| `freights`            | id, tenant_id, status, freight_type, route, cargo, dimensions, prices, windows, requirements, timestamps          | tenant                                  | status/type/currency CHECKs; tenant/status and route indexes; RLS                  |
| `audit_events`        | id, tenant_id, actor_user_id, action, entity_type/id, request_id, before_state, after_state, metadata, created_at | tenant; optional actor                  | tenant/time and entity/time indexes; RLS with USING/WITH CHECK                     |
| `freight_assignments` | id, tenant_id, freight_id, driver_id, vehicle_id, status, lifecycle timestamps                                    | freight + driver + vehicle, same tenant | composite FKs; lifecycle CHECK; partial unique active indexes; RLS                 |

## Freight fields

`freights` currently stores:

- `status`: draft/open/matching/negotiating/assigned/in_transit/delivered/cancelled
- `freight_type`: dedicated/shared/complement/urgent
- origin/destination city and state
- cargo description
- quantity and weight
- optional volume and linear meters
- optional customer and driver prices in cents
- fixed currency `BRL`
- collection and delivery time windows
- matching requirements: vehicle types, body types, minimum free meters and minimum capacity

## IAM fields

Permissions currently seeded include freight CRUD, driver read/create/update, vehicle read/create/update, carrier read/create/update, `iam:manage`, and matching read/assign permissions.

The authoritative membership lookup combines the membership's legacy `role` text with `role_id`/role-permission mappings and reports effective permission codes plus active state.

## Tenant isolation

Tenant-scoped tables carry `tenant_id`. RLS is enabled and forced on critical tables. Policies compare `tenant_id` with `current_setting('app.tenant_id', true)`. The application database layer exposes `tenantSessionSql()` and tenant transaction helpers.

Relationship hardening is explicit: drivers may reference only a carrier in the same tenant and vehicles may reference only a driver in the same tenant. Freight assignments similarly use composite `(tenant_id, id)` references for freight, driver and vehicle.

## Assignment invariants

An assignment is:

- `active`: `completed_at` and `cancelled_at` must be null;
- `completed`: `completed_at` must be set and `cancelled_at` null;
- `cancelled`: `cancelled_at` must be set and `completed_at` null.

Partial unique indexes enforce at most one active assignment per tenant/freight, tenant/driver and tenant/vehicle.

Matching must also treat an active assignment as resource occupancy. Candidate discovery therefore excludes any driver or vehicle already referenced by an `active` freight assignment, even if the vehicle master-data status remains `available`. This prevents the matching list from offering a resource that cannot be assigned atomically.

Assignment is valid from both `matching` and `negotiating` freight states because the domain lifecycle explicitly permits `negotiating -> assigned`. The assignment transaction locks the freight, driver and vehicle rows, rejects active occupancy, creates the assignment and moves the freight to `assigned` atomically.

Freight terminal lifecycle is synchronized with assignment lifecycle in the same database transaction:

- moving a freight to `delivered` requires an active assignment and atomically marks that assignment `completed` with `completed_at`;
- moving a freight to `cancelled` atomically marks any active assignment `cancelled` with `cancelled_at`;
- assignment audit events are emitted in the same transaction as the freight status change;
- if assignment synchronization fails, the entire freight status transaction rolls back.

This prevents delivered/cancelled freights from leaving an active assignment that would permanently block matching for the driver or vehicle.

## Migration history

1. Foundation: tenants, users, memberships and initial RLS.
2. Freight operations: carriers, drivers, vehicles and freights.
3. IAM: roles, permissions and role mappings.
4. Membership bootstrap function.
5. RLS hardening for tenants/users.
6. Authoritative membership/permission resolution.
7. Freight matching requirements.
8. Audit events.
9. Runtime bootstrap grant for membership verification.
10. Same-tenant master-data relationship hardening.
11. Freight assignments and matching permissions.

Migrations are forward-only by default. Production schema changes should use expand/contract when old and new application versions need compatibility.

## Backup and recovery requirement

Neon/PostgreSQL backup policy must be configured and tested independently of application code. A production release is not considered hardened until a restore drill demonstrates that migrations, application configuration and tenant data can be recovered to a known-good state.
