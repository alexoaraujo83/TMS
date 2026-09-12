alter table trips
  drop constraint if exists trips_check;

alter table trips
  add constraint trips_lifecycle_consistency_check
  check (
    (status = 'planned' and started_at is null and delivered_at is null and cancelled_at is null)
    or (status = 'in_transit' and started_at is not null and delivered_at is null and cancelled_at is null)
    or (status = 'delivered' and started_at is not null and delivered_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and delivered_at is null)
  );
