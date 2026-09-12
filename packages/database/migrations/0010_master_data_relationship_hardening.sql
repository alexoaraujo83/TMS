-- Harden tenant ownership at the database boundary. A child row may only
-- reference a parent belonging to the same tenant.

create unique index if not exists uq_carriers_tenant_id on carriers (tenant_id, id);
create unique index if not exists uq_drivers_tenant_id on drivers (tenant_id, id);

alter table drivers
  drop constraint if exists drivers_carrier_id_fkey;

alter table drivers
  add constraint drivers_carrier_same_tenant_fkey
  foreign key (tenant_id, carrier_id)
  references carriers (tenant_id, id)
  on delete set null (carrier_id);

alter table vehicles
  drop constraint if exists vehicles_driver_id_fkey;

alter table vehicles
  add constraint vehicles_driver_same_tenant_fkey
  foreign key (tenant_id, driver_id)
  references drivers (tenant_id, id)
  on delete set null (driver_id);
