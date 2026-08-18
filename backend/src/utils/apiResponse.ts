export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export function successResponse<T>(data: T): { success: true; data: T };
export function successResponse<T>(
  data: T,
  pagination: Pagination,
): { success: true; data: T; pagination: Pagination };
export function successResponse<T>(data: T, pagination?: Pagination) {
  return pagination
    ? { success: true as const, data, pagination }
    : { success: true as const, data };
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNextPage: page < totalPages };
}
