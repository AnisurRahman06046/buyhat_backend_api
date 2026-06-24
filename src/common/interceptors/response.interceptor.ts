import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../constants';
import { PaginatedResponseDto } from '../dto';
import { ApiResponse } from '../interfaces';

type RequestWithId = Request & { id?: string };

/**
 * Wraps every successful controller return value in the standard
 * ApiResponse envelope. If the controller returns a PaginatedResponseDto,
 * its `meta` is lifted to the top level and `data` becomes the items array.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<unknown>> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<unknown>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Success';

    return next.handle().pipe(
      map((payload): ApiResponse<unknown> => {
        const base = {
          success: true as const,
          statusCode: response.statusCode ?? HttpStatus.OK,
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId: request.id,
        };

        if (payload instanceof PaginatedResponseDto) {
          return { ...base, data: payload.items, meta: payload.meta };
        }
        return { ...base, data: payload ?? null };
      }),
    );
  }
}
