import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorResponse } from '../interfaces';

type RequestWithId = Request & { id?: string };
interface PostgresError {
  code?: string;
  detail?: string;
}

/**
 * Translates raw TypeORM/Postgres driver errors into clean HTTP responses
 * so the database's internals never leak to clients.
 */
@Catch(QueryFailedError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const pg = exception as unknown as PostgresError;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';
    let code = 'DATABASE_ERROR';

    switch (pg.code) {
      case '23505': // unique_violation
        statusCode = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        code = 'UNIQUE_VIOLATION';
        break;
      case '23503': // foreign_key_violation
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Related resource not found or still in use';
        code = 'FOREIGN_KEY_VIOLATION';
        break;
      case '23502': // not_null_violation
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'A required field is missing';
        code = 'NOT_NULL_VIOLATION';
        break;
      default:
        break;
    }

    const path = httpAdapter.getRequestUrl(request) as string;
    const isProduction = process.env.NODE_ENV === 'production';
    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      error: { code, details: isProduction ? undefined : pg.detail },
      timestamp: new Date().toISOString(),
      path,
      requestId: request.id,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`DB error on ${request.method} ${path}: ${exception.message}`, exception.stack);
    }

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }
}
