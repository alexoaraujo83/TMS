import type { Pool } from "pg";

export interface Auth0IdentityBootstrapRecord {
  userId: string;
  tenantId: string | null;
  linked: boolean;
}

export async function bootstrapAuth0Identity(
  pool: Pool,
  input: {
    auth0Subject: string;
    email: string;
    displayName: string;
    tenantId?: string | null;
  },
): Promise<Auth0IdentityBootstrapRecord> {
  const result = await pool.query<Auth0IdentityBootstrapRecord>(
    `select user_id as "userId",
            tenant_id as "tenantId",
            linked
       from public.bootstrap_auth0_identity($1, $2, $3, $4::uuid)`,
    [
      input.auth0Subject,
      input.email,
      input.displayName,
      input.tenantId ?? null,
    ],
  );

  const record = result.rows[0];
  if (!record) throw new Error("Auth0 identity bootstrap returned no record");
  return record;
}
