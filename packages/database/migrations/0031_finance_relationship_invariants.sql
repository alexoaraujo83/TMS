-- Enforce the financial invariant that optional assignment/trip references
-- belong to the same tenant and freight as the financial entry.

alter table trips
  add constraint trips_tenant_freight_id_unique
  unique (tenant_id, freight_id, id);

alter table financial_entries
  drop constraint if exists financial_entries_assignment_fk;
alter table financial_entries
  add constraint financial_entries_assignment_fk
  foreign key (tenant_id, freight_id, assignment_id)
  references freight_assignments (tenant_id, freight_id, id)
  on delete set null;

alter table financial_entries
  drop constraint if exists financial_entries_trip_fk;
alter table financial_entries
  add constraint financial_entries_trip_fk
  foreign key (tenant_id, freight_id, trip_id)
  references trips (tenant_id, freight_id, id)
  on delete set null;
