import {
  createLogger,
  type LogContext,
  type LogLevel,
} from "@tms/observability";

export function createFrontendLogger(
  emit?: (line: string) => void,
) {
  return createLogger({
    service: "tms-web",
    emit,
  });
}

const logger = createFrontendLogger();

export function logFrontendEvent(
  level: LogLevel,
  event: string,
  context: LogContext = {},
  details: Record<string, unknown> = {},
): void {
  logger.log(level, event, context, details);
}
