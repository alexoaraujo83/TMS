import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { NestMiddleware } from "@nestjs/common";

export interface RequestTelemetryEvent {
  event: "api.request.completed";
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export interface RequestTelemetryMiddlewareOptions {
  emit?: (event: RequestTelemetryEvent) => void;
  now?: () => number;
}

export class RequestTelemetryMiddleware implements NestMiddleware {
  private readonly emit: (event: RequestTelemetryEvent) => void;
  private readonly now: () => number;

  constructor(options: RequestTelemetryMiddlewareOptions = {}) {
    this.emit = options.emit ?? ((event) => console.info(JSON.stringify(event)));
    this.now = options.now ?? Date.now;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = this.now();
    const requestId = req.header("x-request-id") ?? randomUUID();

    res.once("finish", () => {
      const durationMs = Math.max(0, this.now() - startedAt);
      this.emit({
        event: "api.request.completed",
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      });
    });

    next();
  }
}
