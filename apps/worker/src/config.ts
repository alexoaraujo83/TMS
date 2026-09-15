const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_WORKER_CONFIG:${name}`);
  }

  return value;
}

export function parseTenantIds(raw: string | undefined): string[] {
  const tenantIds = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const invalidTenantId = tenantIds.find((tenantId) => !UUID_PATTERN.test(tenantId));
  if (invalidTenantId) {
    throw new Error(`INVALID_WORKER_CONFIG:OUTBOX_TENANT_IDS:${invalidTenantId}`);
  }

  return [...new Set(tenantIds)];
}
