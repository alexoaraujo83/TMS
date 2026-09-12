import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Reference-grade predicates adopted from Nexora TMS.
 * RLS remains database-enforced; application tenant checks are defense in depth.
 */
export function tenantMatchesSession(tenantId: AnyPgColumn) {
  return sql`${tenantId} = nullif(current_setting('app.tenant_id', true), '')::uuid`;
}

export function userMatchesSession(userId: AnyPgColumn) {
  return sql`${userId} = nullif(current_setting('app.user_id', true), '')::uuid`;
}

export function tenantOrUserMatchesSession(
  tenantId: AnyPgColumn,
  userId: AnyPgColumn,
) {
  return sql`(${tenantMatchesSession(tenantId)}) OR (${userMatchesSession(userId)})`;
}
