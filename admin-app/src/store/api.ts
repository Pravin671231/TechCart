import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { ADMIN_API_BASE_URL } from "@/config/env";
import { clearAdminKey, type AuthState } from "./authSlice";

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

const rawBaseQuery = fetchBaseQuery({
  baseUrl: ADMIN_API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const { adminKey } = (getState() as { auth: AuthState }).auth;
    if (adminKey) {
      headers.set("X-Admin-Key", adminKey);
    }
    return headers;
  },
});

const baseQueryWithAdminKeyGuard: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiCtx,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, apiCtx, extraOptions);
  if (result.error?.status === 401) {
    apiCtx.dispatch(clearAdminKey());
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAdminKeyGuard,
  tagTypes: ["Brand"],
  endpoints: () => ({}),
});
