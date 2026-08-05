import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { NEXT_PUBLIC_API_URL } from "./env";

export type NormalizedApiError = { code: string; message: string };

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

type EnvelopeMeta = { pagination?: Pagination };

type BackendErrorBody =
  | { success: false; code: string; message: string }
  | { success: false; code: string; errors: Record<string, string> };

function isBackendErrorBody(data: unknown): data is BackendErrorBody {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).success === false &&
    typeof (data as Record<string, unknown>).code === "string"
  );
}

function normalizeError(error: FetchBaseQueryError): NormalizedApiError {
  const body = error.data;

  if (isBackendErrorBody(body)) {
    const message =
      "message" in body
        ? body.message
        : Object.values(body.errors).join("; ") || "Validation failed.";
    return { code: body.code, message };
  }

  // Network failure / non-JSON response / CORS failure — not a backend {success:false} envelope.
  return {
    code: typeof error.status === "string" ? error.status : "UNKNOWN_ERROR",
    message: "Unable to reach the server. Please try again.",
  };
}

const rawBaseQuery = fetchBaseQuery({ baseUrl: NEXT_PUBLIC_API_URL });

const baseQueryWithEnvelope: BaseQueryFn<
  string | FetchArgs,
  unknown,
  NormalizedApiError,
  object,
  EnvelopeMeta
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error) {
    return { error: normalizeError(result.error) };
  }

  const body = result.data as { success: true; data: unknown; pagination?: Pagination };
  return {
    data: body.data,
    meta: body.pagination ? { pagination: body.pagination } : {},
  };
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithEnvelope,
  tagTypes: ["Product", "Category"],
  endpoints: () => ({}),
});
