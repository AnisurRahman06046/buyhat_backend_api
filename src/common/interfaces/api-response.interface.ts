export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Standard success envelope returned by ResponseInterceptor. */
export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
  path: string;
  requestId?: string;
}

/** Standard error envelope returned by the exception filters. */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
  requestId?: string;
}
