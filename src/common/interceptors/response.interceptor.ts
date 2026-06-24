import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApiSuccessResponse,
  PaginationMeta,
} from '../interfaces/api-response.interface';

/**
 * A controller may return a plain payload, or an object shaped like
 * `{ data, pagination }` to attach pagination metadata to the envelope.
 */
export interface Paginated<T> {
  data: T;
  pagination: PaginationMeta;
}

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'pagination' in value
  );
}

/**
 * Wraps every successful response in the uniform success envelope:
 *   { success: true, data, meta }
 * Pagination metadata, when present, is merged into `meta`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();

    // Terminus owns the health-check response shape ({ status, info, details }).
    // Wrapping it in our { success, data } envelope breaks tools that parse it,
    // so health endpoints pass through untouched.
    if (request.url.startsWith('/health')) {
      return next.handle() as Observable<ApiSuccessResponse<T>>;
    }

    return next.handle().pipe(
      map((payload): ApiSuccessResponse<T> => {
        if (isPaginated<T>(payload)) {
          return {
            success: true,
            data: payload.data,
            meta: {
              timestamp: new Date().toISOString(),
              path: request.url,
              pagination: payload.pagination,
            },
          };
        }

        return {
          success: true,
          data: payload,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
          },
        };
      }),
    );
  }
}
