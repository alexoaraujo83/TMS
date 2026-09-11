alter table tenants enable row level security;
alter table tenants force row level security;
alter table users enable row level security;
alter table users force row level security;

create policy tenants_self_isolation on tenants
  using (id::text = current_setting('app.tenant_id', true));

create policy users_tenant_membership_isolation on users
  using (
    exists (
      select 1
        from tenant_memberships tm
       where tm.user_id = users.id
         and tm.tenant_id::text = current_setting('app.tenant_id', true)
    )
  );
