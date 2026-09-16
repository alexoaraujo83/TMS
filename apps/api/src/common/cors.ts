export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin !== undefined && allowedOrigins.includes(origin);
}
