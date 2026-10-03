-- Normalize the legacy duplicate 0036 migration version and harden migration history.
-- The repository historically contained two files using the 0036 prefix.
-- Keep the Auth0 bootstrap record at 0036 and reconcile the project-control
-- record to its new canonical 0040 filename before enforcing uniqueness.
--
-- 0040 runs immediately before this migration, so a live database may already
-- contain both the legacy 0036 record and the new 0040 record. In that case,
-- remove only the obsolete history row; the actual Project Control schema/state
-- remains untouched.

delete from public.schema_migrations
 where version = '0036_project_control_center.sql'
   and exists (
     select 1
       from public.schema_migrations
      where version = '0040_project_control_center_reconciliation.sql'
   );

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
