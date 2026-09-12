do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
    from pg_constraint c
   where c.conrelid = 'trips'::regclass
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) like '%status = ''planned''%'
     and pg_get_constraintdef(c.oid) like '%cancelled_at%'
   limit 1;

  if constraint_name is not null then
    execute format('alter table trips drop constraint %I', constraint_name);
  end if;
end $$;

alter table trips
  add constraint trips_status_timestamps_check
  check (
    (status = 'planned' and started_at is null and delivered_at is null and cancelled_at is null)
    or (status = 'in_transit' and started_at is not null and delivered_at is null and cancelled_at is null)
    or (status = 'delivered' and started_at is not null and delivered_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and delivered_at is null)
  );
