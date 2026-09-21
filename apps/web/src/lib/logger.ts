import { createLogger, type LogContext } from "@tms/observability";

const logger = createLogger({ service: "tms-web" });

export function logFrontendEvent(
  level: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL",
  event: string,
  context: LogContext = {},
  details: Record<string, unknown> = {},
): void {
  logger.log(level, event, context, details);
}
