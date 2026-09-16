-- Enforce the domain invariant that a compliance/GR assignment belongs
-- to the same freight referenced by the record.
--
-- The existing tenant-scoped foreign keys prove tenant isolation, but they
-- do not prove the freight_id + assignment_id relationship inside a tenant.
-- Add a composite reference so the database remains authoritative even when
-- application code is bypassed.

alter table freight_assignments
  drop constraint if exists freight_assignments_tenant_freight_id_unique;

alter table freight_assignments
  add constraint freight_assignments_tenant_freight_id_unique
  unique (tenant_id, freight_id, id);

alter table compliance_checks
  drop constraint if exists compliance_checks_assignment_fk;

alter table compliance_checks
  add constraint compliance_checks_assignment_fk
  foreign key (tenant_id, freight_id, assignment_id)
  references freight_assignments (tenant_id, freight_id, id);

alter table gr_requests
  drop constraint if exists gr_requests_assignment_fk;

alter table gr_requests
  add constraint gr_requests_assignment_fk
  foreign key (tenant_id, freight_id, assignment_id)
  references freight_assignments (tenant_id, freight_id, id);
