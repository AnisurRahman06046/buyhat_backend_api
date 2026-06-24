import { PaginationMeta } from '../interfaces';

/**
 * Wrap a page of results in this class from services/controllers.
 * ResponseInterceptor detects it (instanceof) and lifts `meta` to the
 * top level of the response envelope, exposing `data` as the items array.
 */
export class PaginatedResponseDto<T> {
  readonly items: T[];
  readonly meta: PaginationMeta;

  constructor(items: T[], meta: PaginationMeta) {
    this.items = items;
    this.meta = meta;
  }

  static create<T>(
    items: T[],
    totalItems: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, limit)));
    return new PaginatedResponseDto<T>(items, {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    });
  }
}
