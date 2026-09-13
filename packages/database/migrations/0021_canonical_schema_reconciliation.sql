-- Canonical schema reconciliation for the TMS database baseline.
--
-- 0018 defines the canonical compliance/GR contract for a clean database.
-- This migration also repairs databases that were created from an older
-- implementation of those tables without removing tenant-scoped data.

alter table compliance_checks
  add column if not exists check_type text,
  add column if not exists external_reference text,
  add column if not exists metadata jsonb,
  add column if not exists checked_at timestamptz,
  add column if not exists expires_at timestamptz;

update compliance_checks
set
  metadata = coalesce(metadata, details, '{}'::jsonb),
  check_type = coalesce(check_type, result, 'legacy');

alter table compliance_checks
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null,
  alter column check_type set not null;

alter table compliance_checks
  drop constraint if exists compliance_checks_status_check;
alter table compliance_checks
  add constraint compliance_checks_status_check
  check (status in ('pending', 'approved', 'rejected', 'expired'));

alter table compliance_checks
  drop constraint if exists compliance_checks_timestamps_check;
alter table compliance_checks
  add constraint compliance_checks_timestamps_check
  check (
    (status = 'pending' and checked_at is null)
    or (status in ('approved', 'rejected', 'expired') and checked_at is not null)
  );

alter table compliance_checks
  add constraint compliance_checks_tenant_id_unique unique (tenant_id, id);

alter table compliance_checks
  drop constraint if exists compliance_checks_freight_fk;
alter table compliance_checks
  drop constraint if exists compliance_checks_assignment_fk;
alter table compliance_checks
  drop constraint if exists compliance_checks_tenant_id_freight_id_fkey;
alter table compliance_checks
  drop constraint if exists compliance_checks_tenant_id_assignment_id_fkey;

alter table compliance_checks
  add constraint compliance_checks_freight_fk
  foreign key (tenant_id, freight_id)
  references freights (tenant_id, id)
  on delete cascade;

alter table compliance_checks
  add constraint compliance_checks_assignment_fk
  foreign key (tenant_id, assignment_id)
  references freight_assignments (tenant_id, id)
  on delete set null;

create index if not exists compliance_checks_tenant_status_idx
  on compliance_checks (tenant_id, status, created_at desc);
create index if not exists compliance_checks_freight_idx
  on compliance_checks (tenant_id, freight_id, created_at desc);

alter table gr_requests
  add column if not exists protocol text,
  add column if not exists external_reference text,
  add column if not exists metadata jsonb,
  add column if not exists submitted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists expires_at timestamptz;

update gr_requests
set
  external_reference = coalesce(external_reference, external_id),
  metadata = coalesce(metadata, details, '{}'::jsonb),
  submitted_at = coalesce(submitted_at, requested_at);

alter table gr_requests
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table gr_requests
  drop constraint if exists gr_requests_status_check;
alter table gr_requests
  add constraint gr_requests_status_check
  check (status in ('pending', 'submitted', 'approved', 'rejected', 'expired', 'cancelled'));

alter table gr_requests
  drop constraint if exists gr_requests_timestamps_check;
alter table gr_requests
  add constraint gr_requests_timestamps_check
  check (
    (status = 'pending' and submitted_at is null and approved_at is null and rejected_at is null)
    or (status = 'submitted' and submitted_at is not null and approved_at is null and rejected_at is null)
    or (status = 'approved' and submitted_at is not null and approved_at is not null and rejected_at is null)
    or (status = 'rejected' and submitted_at is not null and approved_at is null and rejected_at is not null)
    or (status in ('expired', 'cancelled') and rejected_at is null)
  );

alter table gr_requests
  add constraint gr_requests_tenant_id_unique unique (tenant_id, id);

alter table gr_requests
  drop constraint if exists gr_requests_freight_fk;
alter table gr_requests
  drop constraint if exists gr_requests_assignment_fk;
alter table gr_requests
  drop constraint if exists gr_requests_tenant_id_freight_id_fkey;
alter table gr_requests
  drop constraint if exists gr_requests_tenant_id_assignment_id_fkey;

alter table gr_requests
  add constraint gr_requests_freight_fk
  foreign key (tenant_id, freight_id)
  references freights (tenant_id, id)
  on delete cascade;

alter table gr_requests
  add constraint gr_requests_assignment_fk
  foreign key (tenant_id, assignment_id)
  references freight_assignments (tenant_id, id)
  on delete set null;

create index if not exists gr_requests_tenant_status_idx
  on gr_requests (tenant_id, status, created_at desc);
create index if not exists gr_requests_freight_idx
  on gr_requests (tenant_id, freight_id, created_at desc);

-- Canonical lifecycle invariant is installed by 0017; keep this migration
-- defensive for databases that reached 0021 through a partially reconciled path.
alter table trips
  drop constraint if exists trips_check;
alter table trips
  drop constraint if exists trips_lifecycle_consistency_check;
alter table trips
  drop constraint if exists trips_status_timestamps_check;

alter table trips
  add constraint trips_status_timestamps_check
  check (
    (status = 'planned' and started_at is null and delivered_at is null and cancelled_at is null)
    or (status = 'in_transit' and started_at is not null and delivered_at is null and cancelled_at is null)
    or (status = 'delivered' and started_at is not null and delivered_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and delivered_at is null)
  );
