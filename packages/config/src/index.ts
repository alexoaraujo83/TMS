export type AppEnvironment = "local" | "development" | "staging" | "production";

export interface AppConfig {
  nodeEnv: string;
  appEnv: AppEnvironment;
  appName: string;
  appUrl: string;
  apiUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtSecret: string;
  logLevel: string;
}

type Environment = Record<string, string | undefined>;

function required(env: Environment, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
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
    redisUrl: required(env, "REDIS_URL"),
    jwtIssuer: required(env, "JWT_ISSUER"),
    jwtAudience: required(env, "JWT_AUDIENCE"),
    jwtSecret: required(env, "JWT_SECRET"),
    logLevel: env.LOG_LEVEL ?? "info",
  };
}
