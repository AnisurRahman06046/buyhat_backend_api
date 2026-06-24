import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

/** Postgres error code for a unique-constraint violation. */
const PG_UNIQUE_VIOLATION = '23505';

interface DriverError {
  code?: string;
  detail?: string;
}

/**
 * The single global exception filter. Translates every error — framework
 * HttpExceptions, validation failures, database driver errors, and unexpected
 * programmer errors — into the uniform error envelope:
 *
 *   { success: false, error: { code, message, details }, meta }
 *
 * Having exactly one filter removes the ordering hazard of overlapping global
 * filters (a catch-all `@Catch()` shadows a specific one) and guarantees
 * validation `details` are never dropped.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction = false) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HttpStatus[status] ?? 'HTTP_ERROR';
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        // class-validator returns `message` as a string[] of failures.
        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          details = body.message;
        } else {
          message = (body.message as string) ?? exception.message;
        }
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = (
        exception as unknown as { driverError?: DriverError }
      ).driverError;
      if (driverError?.code === PG_UNIQUE_VIOLATION) {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'Resource already exists';
      } else {
        // Never leak SQL internals to clients.
        status = HttpStatus.BAD_REQUEST;
        code = 'DATABASE_ERROR';
        message = 'A database error occurred';
      }
    } else if (exception instanceof Error) {
      message = this.isProduction ? 'Internal server error' : exception.message;
    }

    // Log everything that isn't a deliberate HttpException, with the stack.
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: { code, message, details },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };

    response.status(status).json(body);
  }
}
