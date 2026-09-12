import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { NestMiddleware } from "@nestjs/common";

export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header("x-request-id");
    const requestId =
      incoming && incoming.length <= 128 ? incoming : randomUUID();

    // Keep the canonical value available to downstream guards/services so
    // audit records and logs correlate with the response header.
    req.headers["x-request-id"] = requestId;

    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );

    next();
  }
}
