import { api } from "@/store/api";
import type { Address, AddressInput } from "./types";

// Same optimistic-cache idiom cart/api.ts established: patch the getAddresses
// list cache immediately in onQueryStarted, then reconcile with the server's
// authoritative response once it lands; .undo() rolls the patch back on
// error. Every mutation here returns a single Address, not the whole list
// (unlike cart's mutations, which always return the full cart) — so
// reconciliation targets one entry in the cached array rather than replacing
// the array wholesale.
export const addressesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAddresses: builder.query<Address[], void>({
      query: () => ({ url: "/api/addresses" }),
      providesTags: ["Address"],
    }),

    addAddress: builder.mutation<Address, AddressInput>({
      query: (body) => ({ url: "/api/addresses", method: "POST", body }),
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const tempId = `temp-${Date.now()}`;
        const patch = dispatch(
          addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
            draft.unshift({ _id: tempId, isDefault: false, ...input });
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
              const index = draft.findIndex((address) => address._id === tempId);
              if (index !== -1) draft[index] = data;
            }),
          );
        } catch {
          patch.undo();
        }
      },
    }),

    updateAddress: builder.mutation<Address, { id: string; input: Partial<AddressInput> }>({
      query: ({ id, input }) => ({ url: `/api/addresses/${id}`, method: "PATCH", body: input }),
      async onQueryStarted({ id, input }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
            const address = draft.find((a) => a._id === id);
            if (address) Object.assign(address, input);
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
              const index = draft.findIndex((address) => address._id === id);
              if (index !== -1) draft[index] = data;
            }),
          );
        } catch {
          patch.undo();
        }
      },
    }),

    deleteAddress: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({ url: `/api/addresses/${id}`, method: "DELETE" }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
            return draft.filter((address) => address._id !== id);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    setDefaultAddress: builder.mutation<Address, { id: string }>({
      query: ({ id }) => ({ url: `/api/addresses/${id}/default`, method: "PATCH" }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
            for (const address of draft) {
              address.isDefault = address._id === id;
            }
          }),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            addressesApi.util.updateQueryData("getAddresses", undefined, (draft) => {
              const index = draft.findIndex((address) => address._id === id);
              if (index !== -1) draft[index] = data;
            }),
          );
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} = addressesApi;
