import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { NestMiddleware } from "@nestjs/common";
import { createLogger, type LogContext } from "@tms/observability";

export interface RequestTelemetryEvent {
  event: "api.request.completed";
  requestId: string;
  correlationId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  tenantId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RequestTelemetryMiddlewareOptions {
  emit?: (event: RequestTelemetryEvent) => void;
  now?: () => number;
}

export class RequestTelemetryMiddleware implements NestMiddleware {
  private readonly emit: (event: RequestTelemetryEvent) => void;
  private readonly now: () => number;

  constructor(options: RequestTelemetryMiddlewareOptions = {}) {
    this.emit = options.emit ?? ((event) => {
      const logger = createLogger({ service: process.env.LOG_SERVICE ?? "tms-api" });
      const context: LogContext = {
        requestId: event.requestId,
        correlationId: event.correlationId,
        tenantId: event.tenantId,
        userId: event.userId,
      };
      const details = {
        method: event.method,
        route: event.path,
        status_code: event.statusCode,
        duration_ms: event.durationMs,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
      };
      logger.log("INFO", event.event, context, details);
    });
    this.now = options.now ?? Date.now;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = this.now();
    const requestId = req.header("x-request-id") ?? randomUUID();
    const correlationId = req.header("x-correlation-id") ?? requestId;
    const requestWithContext = req as Request & { context?: { tenantId?: string; userId?: string } };
    const clientIp = req.ip;
    const userAgent = req.header("user-agent") ?? undefined;

    if (typeof res.setHeader === "function") {
      res.setHeader("X-Request-Id", requestId);
      res.setHeader("X-Correlation-Id", correlationId);
    }

    res.once("finish", () => {
      const durationMs = Math.max(0, this.now() - startedAt);
      try {
        const context = (req as Request & { context?: { tenantId?: string; userId?: string } }).context;
        this.emit({
          event: "api.request.completed",
          requestId,
          correlationId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs,
          tenantId: context?.tenantId,
          userId: context?.userId,
          ipAddress: clientIp,
          userAgent,
        });
      } catch {
        // Observability must never affect request lifecycle.
      }
    });
    next();
  }
}
