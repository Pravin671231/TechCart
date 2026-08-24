import { api } from "@/app/api/baseApi";
import { unwrapData, unwrapList } from "@/app/api/apiResponse";
import { notifyApiError, notifyApiSuccess } from "@/app/api/apiToast";
import type { ApiSuccessEnvelope, ApiSuccessListEnvelope, Pagination } from "@/app/api/api.types";
import type { AdminUser, CreateAdminUserInput, UpdateAdminUserInput } from "./types";

export interface ListAdminUsersParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface UpdateAdminUserArgs {
  id: string;
  patch: UpdateAdminUserInput;
}

export const adminUsersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminUsers: build.query<
      { items: AdminUser[]; pagination: Pagination },
      ListAdminUsersParams | void
    >({
      query: (params) => ({
        url: "/users",
        params: {
          search: params?.search || undefined,
          page: params?.page,
          limit: params?.limit,
        },
      }),
      transformResponse: (response: ApiSuccessListEnvelope<AdminUser>) => unwrapList(response),
      providesTags: ["AdminUser"],
    }),
    createAdminUser: build.mutation<AdminUser, CreateAdminUserInput>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      transformResponse: (response: ApiSuccessEnvelope<AdminUser>) => unwrapData(response),
      invalidatesTags: ["AdminUser"],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          await queryFulfilled;
          notifyApiSuccess("Admin created — password reset email sent.");
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to create admin.");
        }
      },
    }),
    updateAdminUser: build.mutation<AdminUser, UpdateAdminUserArgs>({
      query: ({ id, patch }) => ({ url: `/users/${id}`, method: "PATCH", body: patch }),
      transformResponse: (response: ApiSuccessEnvelope<AdminUser>) => unwrapData(response),
      invalidatesTags: ["AdminUser"],
      async onQueryStarted({ patch }, { queryFulfilled }) {
        try {
          await queryFulfilled;
          if (patch.status !== undefined) {
            notifyApiSuccess(patch.status ? "Admin activated." : "Admin deactivated.");
          } else {
            notifyApiSuccess("Admin role updated.");
          }
        } catch (err) {
          notifyApiError((err as { error: unknown }).error, "Unable to update admin.");
        }
      },
    }),
  }),
});

export const { useGetAdminUsersQuery, useCreateAdminUserMutation, useUpdateAdminUserMutation } =
  adminUsersApi;
