export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type ApiSuccessEnvelope<T> = { success: true; data: T };
export type ApiSuccessListEnvelope<T> = { success: true; data: T[]; pagination: Pagination };
export type ApiErrorEnvelope = { success: false; code: string; message?: string; errors?: unknown };
