import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query/react";
import { ADMIN_API_BASE_URL } from "@/config/env";
import { getToken } from "@/features/authentication/auth/tokenStorage";

// Issue #148/M3.10 — replaces the X-Admin-Key prompt entirely with real
// session-based auth. `credentials: "include"` is needed only for the
// brief cross-site two-factor pending-challenge cookie window between
// POST /sign-in/email and POST /two-factor/verify-otp (backend's
// src/lib/adminChallenge.ts gates that cookie to SameSite=None; Secure on
// a cross-site deployment) — every other request here is authenticated
// purely via the bearer token below, cookies are otherwise unused.
const rawBaseQuery = fetchBaseQuery({
  baseUrl: ADMIN_API_BASE_URL,
  credentials: "include",
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Issue #253 — dev-only request/response logging. `import.meta.env.DEV` is
// statically replaced at build time, so Vite's minifier dead-code-eliminates
// this branch entirely from the production bundle; no headers are logged.
export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  object,
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  const label = typeof args === "string" ? `GET ${args}` : `${args.method ?? "GET"} ${args.url}`;

  if (import.meta.env.DEV) {
    console.groupCollapsed(`[RTK Query] ${label}`);
    console.log("request", args);

    if (typeof args !== "string" && args.body !== undefined) {
      console.log("mutation input (copy for Postman):");
      console.log(JSON.stringify(args.body, null, 2));
    }
  }

  const result = await rawBaseQuery(args, api, extraOptions);

  if (import.meta.env.DEV) {
    console.log("response", result.error ?? result.data);
    console.groupEnd();

    setTimeout(() => {
      console.groupCollapsed(`[RTK Query] cache snapshot — after ${label}`);
      console.log((api.getState() as Record<string, unknown>).api);
      console.groupEnd();
    }, 0);
  }

  return result;
};
