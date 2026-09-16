import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorResponse {
  code: string;
  message: string;
  requestId?: string;
}

export function normalizeHttpExceptionMessage(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (typeof payload !== "object" || payload === null) return "Request failed";

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message.map((item) => String(item)).join("; ");
  }
  return "Request failed";
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = request.header("x-request-id") ?? undefined;
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const payload =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      status >= 500 && payload === undefined
        ? "Internal server error"
        : normalizeHttpExceptionMessage(payload);
    const body: ErrorResponse = {
      code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message,
      requestId,
    };
    response.status(status).json(body);
  }
}
