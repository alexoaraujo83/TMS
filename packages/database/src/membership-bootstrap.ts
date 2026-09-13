import type { Pool } from "pg";

export interface MembershipBootstrapRecord {
  userId: string;
  tenantId: string;
  role: string;
  permissions: readonly string[];
  active: boolean;
}

export async function verifyTenantMembership(
  pool: Pool,
  auth0Subject: string,
  tenantId: string,
): Promise<MembershipBootstrapRecord | null> {
  const result = await pool.query<MembershipBootstrapRecord>(
    `select user_id as "userId",
            tenant_id as "tenantId",
            role,
            permissions,
            active
       from public.check_tenant_membership($1, $2)
      limit 1`,
    [auth0Subject, tenantId],
  );

  return result.rows[0] ?? null;
}
