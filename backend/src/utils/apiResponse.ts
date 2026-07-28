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
