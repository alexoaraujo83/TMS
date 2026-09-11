import { Catch, type ArgumentsHost, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponse { code: string; message: string; requestId?: string; }

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = request.header('x-request-id') ?? undefined;
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof payload === 'string' ? payload : typeof payload === 'object' && payload !== null && 'message' in payload ? String((payload as { message: unknown }).message) : 'Internal server error';
    const body: ErrorResponse = { code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message, requestId };
    response.status(status).json(body);
  }
}
