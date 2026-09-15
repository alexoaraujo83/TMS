export function normalizeDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
