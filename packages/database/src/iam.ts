export interface TenantMembershipRecord {
  userId: string;
  tenantId: string;
  role: string;
  permissions: readonly string[];
  active: boolean;
}

export interface MembershipQueryExecutor {
  query<T>(sql: string, params: readonly unknown[]): Promise<readonly T[]>;
}

export async function findTenantMembership(
  executor: MembershipQueryExecutor,
  userId: string,
  tenantId: string,
): Promise<TenantMembershipRecord | null> {
  const rows = await executor.query<TenantMembershipRecord>(
    `select tm.user_id as "userId", tm.tenant_id as "tenantId", coalesce(r.name, tm.role) as role,
            coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') as permissions,
            (u.status = 'active' and t.status = 'active') as active
       from tenant_memberships tm
       join users u on u.id = tm.user_id
       join tenants t on t.id = tm.tenant_id
       left join roles r on r.id = tm.role_id
       left join role_permissions rp on rp.role_id = r.id
       left join permissions p on p.id = rp.permission_id
      where tm.user_id = $1 and tm.tenant_id = $2
      group by tm.user_id, tm.tenant_id, r.name, tm.role, u.status, t.status`,
    [userId, tenantId],
  );

  return rows[0] ?? null;
}
