-- Normalize the legacy duplicate 0036 migration version and harden migration history.
-- The repository historically contained two files using the 0036 prefix.
-- Keep the Auth0 bootstrap record at 0036 and reconcile the project-control
-- record to its new canonical 0040 filename before enforcing uniqueness.

update public.schema_migrations
   set version = '0040_project_control_center_reconciliation.sql'
 where version = '0036_project_control_center.sql'
   and not exists (
     select 1
       from public.schema_migrations
      where version = '0040_project_control_center_reconciliation.sql'
   );

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.schema_migrations'::regclass
       and contype = 'p'
  ) then
    alter table public.schema_migrations
      add constraint schema_migrations_pkey primary key (version);
  end if;
end;
$$;
