import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { NEXT_PUBLIC_API_URL } from "./env";
import { getToken } from "@/features/authentication/auth/tokenStorage";

export type NormalizedApiError = { code: string; message: string };

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

type EnvelopeMeta = { pagination?: Pagination; authToken?: string };

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

const rawBaseQuery = fetchBaseQuery({
  baseUrl: NEXT_PUBLIC_API_URL,
  prepareHeaders: (headers) => {
    if (typeof window !== "undefined") {
      const token = getToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }
    return headers;
  },
});

const baseQueryWithEnvelope: BaseQueryFn<
  string | FetchArgs,
  unknown,
  NormalizedApiError,
  object,
  EnvelopeMeta
> = async (args, api, extraOptions) => {
  // Issue #253 — dev-only request/response logging. `process.env.NODE_ENV`
  // is statically replaced at build time, so Next's production minifier
  // dead-code-eliminates this branch entirely; no headers are logged.
  const label = typeof args === "string" ? `GET ${args}` : `${args.method ?? "GET"} ${args.url}`;

  if (process.env.NODE_ENV !== "production") {
    console.groupCollapsed(`[RTK Query] ${label}`);
    console.log("request", args);

    if (typeof args !== "string" && args.body !== undefined) {
      console.log("mutation input (copy for Postman):");
      console.log(JSON.stringify(args.body, null, 2));
    }
  }

  const result = await rawBaseQuery(args, api, extraOptions);

  if (process.env.NODE_ENV !== "production") {
    console.log("response", result.error ?? result.data);
    console.groupEnd();

    setTimeout(() => {
      console.groupCollapsed(`[RTK Query] cache snapshot — after ${label}`);
      console.log((api.getState() as Record<string, unknown>).api);
      console.groupEnd();
    }, 0);
  }

  if (result.error) {
    return { error: normalizeError(result.error) };
  }

  const body = result.data as { success: true; data: unknown; pagination?: Pagination };
  const meta: EnvelopeMeta = {};

  if (body.pagination) {
    meta.pagination = body.pagination;
  }

  const authToken = result.meta?.response?.headers.get("set-auth-token");
  if (authToken) {
    meta.authToken = authToken;
  }

  return {
    data: body.data,
    meta,
  };
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithEnvelope,
  tagTypes: ["Product", "Category", "Session", "Cart"],
  endpoints: () => ({}),
});
