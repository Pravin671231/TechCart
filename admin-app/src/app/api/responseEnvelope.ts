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

export function unwrapData<T>(response: ApiSuccessEnvelope<T>): T {
  return response.data;
}

export function unwrapList<T>(response: ApiSuccessListEnvelope<T>): { items: T[]; pagination: Pagination } {
  return { items: response.data, pagination: response.pagination };
}

export function getApiErrorEnvelope(error: unknown): ApiErrorEnvelope | undefined {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "code" in data) {
      return data as ApiErrorEnvelope;
    }
  }
  return undefined;
}
