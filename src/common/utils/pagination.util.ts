import { PaginationMeta } from '../interfaces';

/** Builds pagination metadata from a total count and the current page/limit. */
export function buildPaginationMeta(
  totalItems: number,
  page: number,
  limit: number,
): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
  return {
    page,
    limit: safeLimit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
