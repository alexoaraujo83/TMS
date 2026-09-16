export type AppEnvironment = "local" | "development" | "staging" | "production";

export interface AppConfig {
  nodeEnv: string;
  appEnv: AppEnvironment;
  appName: string;
  appUrl: string;
  apiUrl: string;
  databaseUrl: string;
  databaseDirectUrl: string;
  auth0Domain: string;
  auth0ClientId: string;
  auth0ClientSecret: string;
  auth0Audience: string;
  auth0IssuerBaseUrl: string;
  auth0JwksUrl: string;
  tenantHeader: string;
  workerEnabled: boolean;
  workerConcurrency: number;
  logLevel: string;
}

type Environment = Record<string, string | undefined>;

function required(env: Environment, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function positiveInteger(env: Environment, key: string, fallback: number): number {
  const value = env[key] ?? String(fallback);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid ${key}: ${value}`);
  }
  return parsed;
}

function booleanValue(env: Environment, key: string, fallback: boolean): boolean {
  const value = env[key];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid ${key}: ${value}`);
}

export function loadConfig(env: Environment = {}): AppConfig {
  const appEnv = required(env, "APP_ENV") as AppEnvironment;
  if (!["local", "development", "staging", "production"].includes(appEnv)) {
    throw new Error(`Invalid APP_ENV: ${appEnv}`);
  }

  return {
    nodeEnv: env.NODE_ENV ?? "development",
    appEnv,
    appName: env.APP_NAME ?? "tms",
    appUrl: required(env, "APP_URL"),
    apiUrl: required(env, "API_URL"),
    databaseUrl: required(env, "DATABASE_URL"),
    databaseDirectUrl: required(env, "DATABASE_DIRECT_URL"),
    auth0Domain: required(env, "AUTH0_DOMAIN"),
    auth0ClientId: required(env, "AUTH0_CLIENT_ID"),
    auth0ClientSecret: required(env, "AUTH0_CLIENT_SECRET"),
    auth0Audience: required(env, "AUTH0_AUDIENCE"),
    auth0IssuerBaseUrl: required(env, "AUTH0_ISSUER_BASE_URL"),
    auth0JwksUrl: required(env, "AUTH0_JWKS_URL"),
    tenantHeader: env.TENANT_HEADER ?? "x-tenant-id",
    workerEnabled: booleanValue(env, "WORKER_ENABLED", false),
    workerConcurrency: positiveInteger(env, "WORKER_CONCURRENCY", 5),
    logLevel: env.LOG_LEVEL ?? "info",
  };
}
