import { api } from "@/store/api";
import type { AccountProfile } from "./types";

export const accountApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<AccountProfile, void>({
      query: () => "/api/account/profile",
      providesTags: ["Session"],
    }),

    updateProfile: builder.mutation<AccountProfile, { name?: string; phone?: string }>({
      query: (body) => ({
        url: "/api/account/profile",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Session"],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = accountApi;
