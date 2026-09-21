export type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

export interface LogContext {
  requestId?: string | undefined;
  correlationId?: string | undefined;
  tenantId?: string | undefined;
  userId?: string | undefined;
  subject?: string | undefined;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "authorization", "access_token", "refresh_token", "id_token", "client_secret",
  "auth0_client_secret", "password", "secret", "api_key", "cookie", "session",
  "database_url", "connection_string", "private_key",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[- ]/g, "_");
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("_secret");
}

export function redact<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redact(item)) as T;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack } as T;
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? "[REDACTED]" : redact(item);
    }
    return output as T;
  }
  return value;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  event: string;
  service: string;
  environment: string;
  request_id?: string | undefined;
  correlation_id?: string | undefined;
  tenant_id?: string | undefined;
  user_id?: string | undefined;
  subject?: string | undefined;
  [key: string]: unknown;
}

export function createLogger(options: {
  service: string;
  environment?: string;
  level?: LogLevel;
  emit?: (line: string) => void;
}) {
  const environment = options.environment ?? process.env.LOG_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  const configured = options.level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? "INFO";
  const rank: Record<LogLevel, number> = { TRACE: 10, DEBUG: 20, INFO: 30, WARN: 40, ERROR: 50, CRITICAL: 60 };
  const emit = options.emit ?? ((line: string) => console.log(line));

  return {
    log(level: LogLevel, event: string, context: LogContext = {}, details: Record<string, unknown> = {}) {
      if (rank[level] < rank[configured]) return;
      const record = redact({
        timestamp: new Date().toISOString(),
        level, event, service: options.service, environment,
        request_id: context.requestId, correlation_id: context.correlationId,
        tenant_id: context.tenantId, user_id: context.userId, subject: context.subject,
        ...details,
      }) as StructuredLog;
      emit(JSON.stringify(record));
    },
  };
}
