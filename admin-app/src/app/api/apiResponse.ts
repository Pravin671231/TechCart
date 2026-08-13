import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "./api.types";

export function unwrapData<T>(response: ApiSuccessEnvelope<T>): T {
  return response.data;
}

export function unwrapList<T>(response: ApiSuccessListEnvelope<T>): {
  items: T[];
  pagination: Pagination;
} {
  return { items: response.data, pagination: response.pagination };
}
