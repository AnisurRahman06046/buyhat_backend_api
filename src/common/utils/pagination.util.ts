import { PaginationMeta } from '../interfaces/api-response.interface';

/**
 * Builds a PaginationMeta object from the standard inputs. Use in services that
 * return paginated lists so the meta shape stays consistent everywhere.
 */
export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
