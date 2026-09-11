import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestIdHeader = req.header('x-request-id');
  const requestId = requestIdHeader && requestIdHeader.length <= 128 ? requestIdHeader : randomUUID();

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
}
