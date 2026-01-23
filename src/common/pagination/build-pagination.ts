import { PaginationMeta } from './pagination.types';

export function buildPagination(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? limit : 20;

  return {
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
