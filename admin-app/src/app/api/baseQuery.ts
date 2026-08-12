import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { ADMIN_API_BASE_URL } from "@/config/env";
import { clearAdminKey, type AuthState } from "@/app/store/authSlice";

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

export const baseQueryWithAdminKeyGuard: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, apiCtx, extraOptions) => {
  console.log("➡️ API request:", args);

  const result = await rawBaseQuery(args, apiCtx, extraOptions);

  console.log("⬅️ API response:", result);

  if (result.error?.status === 401) {
    apiCtx.dispatch(clearAdminKey());
  }

  return result;
};