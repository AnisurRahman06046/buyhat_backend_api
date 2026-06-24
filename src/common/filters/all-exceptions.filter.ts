import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { BusinessException } from '../exceptions';
import { ApiErrorResponse } from '../interfaces';

type RequestWithId = Request & { id?: string };

/**
 * Catch-all filter. Normalises every thrown error into the standard
 * ApiErrorResponse envelope and logs 5xx with stack traces.
 *
 * NOTE: register this BEFORE more specific filters (e.g. TypeOrmExceptionFilter)
 * in the providers array, because Nest executes global APP_FILTERs in reverse
 * registration order (last registered runs first).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    if (exception instanceof BusinessException) {
      statusCode = exception.getStatus();
      message = exception.message;
      code = exception.code;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const r = response as Record<string, unknown>;
        const rawMessage = r.message;
        message = Array.isArray(rawMessage)
          ? (rawMessage as string[]).join(', ')
          : ((rawMessage as string) ?? exception.message);
        details = Array.isArray(rawMessage) ? rawMessage : undefined;
      }
      code = this.codeFromStatus(statusCode);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const path = httpAdapter.getRequestUrl(request) as string;
    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      error: { code, details },
      timestamp: new Date().toISOString(),
      path,
      requestId: request.id,
    };

    const logLine = `${request.method} ${path} -> ${statusCode} ${code}: ${message}`;
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(logLine, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(logLine);
    }

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private codeFromStatus(status: number): string {
    return HttpStatus[status] ?? 'ERROR';
  }
}
