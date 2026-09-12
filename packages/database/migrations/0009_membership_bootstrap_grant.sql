revoke all on function public.check_tenant_membership(uuid, uuid) from public;
grant execute on function public.check_tenant_membership(uuid, uuid) to current_user;

comment on function public.check_tenant_membership(uuid, uuid) is
'Runtime bootstrap grant: only the database role executing this migration receives EXECUTE; PUBLIC remains denied.';
