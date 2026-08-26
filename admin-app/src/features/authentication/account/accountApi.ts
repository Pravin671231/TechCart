import { api } from "@/app/api/baseApi";
import { API_URL } from "@/config/env";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";

// Issue #149/M3.11 — /api/account/* isn't nested under ADMIN_API_BASE_URL
// (/api/admin), same reasoning as auth/api.ts's own authUrl() helper: an
// absolute URL bypasses baseApi.ts's baseUrl entirely (RTK Query's
// fetchBaseQuery/joinUrls passes an absolute URL straight through), so this
// reuses the shared `api` instance and its bearer-token prepareHeaders
// without touching any existing catalog endpoint's relative path.
const accountUrl = (path: string) => `${API_URL}/api/account${path}`;

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

type ChangePasswordResponse = ApiSuccessEnvelope<{ changed: boolean }>;

export const accountApi = api.injectEndpoints({
  endpoints: (build) => ({
    changePassword: build.mutation<{ changed: boolean }, ChangePasswordInput>({
      query: (body) => ({ url: accountUrl("/change-password"), method: "POST", body }),
      transformResponse: (response: ChangePasswordResponse) => unwrapData(response),
    }),
  }),
});

export const { useChangePasswordMutation } = accountApi;
