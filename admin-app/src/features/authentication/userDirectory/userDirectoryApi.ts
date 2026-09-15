import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import type { UserDirectoryEntry, UserDirectoryRole } from "./types";

export interface ListUserDirectoryParams {
  search?: string;
  role?: UserDirectoryRole;
  status?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "name" | "email" | "createdAt" | "lastSignInAt";
  orderBy?: "asc" | "desc";
}

export const userDirectoryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getUserDirectory: build.query<
      { items: UserDirectoryEntry[]; pagination: Pagination },
      ListUserDirectoryParams | void
    >({
      query: (params) => ({
        url: "/user-directory",
        params: {
          search: params?.search || undefined,
          role: params?.role || undefined,
          status: params?.status,
          page: params?.page,
          limit: params?.limit,
          sortBy: params?.sortBy,
          orderBy: params?.orderBy,
        },
      }),
      transformResponse: (response: ApiSuccessListEnvelope<UserDirectoryEntry>) =>
        unwrapList(response),
      providesTags: ["UserDirectory"],
    }),
    getUserDirectoryEntry: build.query<UserDirectoryEntry, string>({
      query: (id) => ({ url: `/user-directory/${id}` }),
      transformResponse: (response: ApiSuccessEnvelope<UserDirectoryEntry>) =>
        unwrapData(response),
      providesTags: ["UserDirectory"],
    }),
  }),
});

export const { useGetUserDirectoryQuery, useGetUserDirectoryEntryQuery } = userDirectoryApi;
