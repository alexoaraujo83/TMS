import type { PoolClient } from "pg";

export async function assertComplianceRelease(
  client: PoolClient,
  tenantId: string,
  freightId: string,
  assignmentId?: string,
): Promise<void> {
  const checks = await client.query<{ checkType: string; status: string }>(
    `select distinct on (check_type)
        check_type as "checkType", status
       from compliance_checks
      where tenant_id = $1
        and freight_id = $2
        and (assignment_id is null or assignment_id = $3)
      order by check_type, checked_at desc nulls last, created_at desc`,
    [tenantId, freightId, assignmentId ?? null],
  );

  const blockedChecks = checks.rows.filter((row) => row.status !== "approved");
  if (blockedChecks.length > 0) {
    throw new Error(
      `Compliance release blocked: ${blockedChecks
        .map((row) => `${row.checkType}=${row.status}`)
        .join(", ")}`,
    );
  }

  const gr = await client.query<{ status: string }>(
    `select status
       from gr_requests
      where tenant_id = $1
        and freight_id = $2
        and (assignment_id is null or assignment_id = $3)
      order by created_at desc
      limit 1`,
    [tenantId, freightId, assignmentId ?? null],
  );
  const grStatus = gr.rows[0]?.status;
  if (grStatus && grStatus !== "approved") {
    throw new Error(`Compliance release blocked: gr=${grStatus}`);
  }
}
