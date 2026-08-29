import { api } from "@/store/api";
import type { AccountDashboard } from "./types";

// Issue #175/M7.5 — reuses the "Session" tag account/api.ts's getProfile
// already provides under, rather than a new tag: a profile edit
// (updateProfile, invalidatesTags: ["Session"]) should also refresh this
// dashboard's own embedded profile snapshot.
export const accountHomeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAccountDashboard: builder.query<AccountDashboard, void>({
      query: () => "/api/account/dashboard",
      providesTags: ["Session"],
    }),
  }),
});

export const { useGetAccountDashboardQuery } = accountHomeApi;
