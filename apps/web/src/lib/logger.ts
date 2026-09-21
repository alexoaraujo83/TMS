export type FrontendLogLevel = "debug" | "info" | "warn" | "error";

export interface FrontendLogEvent {
  event: string;
  level?: FrontendLogLevel;
  timestamp?: string;
  requestId?: string;
  durationMs?: number;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "password",
  "secret",
  "api_key",
  "cookie",
  "session",
  "database_url",
  "connection_string",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(child),
      ]),
    );
  }
  return value;
}

export function sanitizeFrontendLog(event: FrontendLogEvent): FrontendLogEvent {
  return {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
    context: event.context ? (redact(event.context) as Record<string, unknown>) : undefined,
  };
}

export function logFrontendEvent(
  event: FrontendLogEvent,
  sink: (level: FrontendLogLevel, payload: FrontendLogEvent) => void = defaultSink,
): void {
  const payload = sanitizeFrontendLog(event);
  sink(payload.level ?? "info", payload);
}

function defaultSink(level: FrontendLogLevel, payload: FrontendLogEvent): void {
  const method = level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info";
  console[method](JSON.stringify(payload));
}
