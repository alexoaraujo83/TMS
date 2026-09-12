create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

comment on function public.set_updated_at() is
'Keeps mutable row updated_at timestamps authoritative at the database boundary.';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants',
    'users',
    'carriers',
    'drivers',
    'vehicles',
    'freights',
    'freight_assignments'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'trg_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end;
$$;
