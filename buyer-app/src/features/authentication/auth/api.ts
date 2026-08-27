import { api } from "@/store/api";
import { setToken, clearToken } from "./tokenStorage";
import { SessionUser } from "./types";

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSession: builder.query<SessionUser | null, void>({
      query: () => "/api/auth/get-session",
      // A signed-out session is `data: null` from the backend (auth.controller.ts
      // getSessionHandler → successResponse(null)); a signed-in one is `data: { user }`.
      transformResponse: (response: { user?: SessionUser | null } | null) => response?.user ?? null,
      providesTags: ["Session"],
    }),

    oneTapSignIn: builder.mutation<SessionUser, { idToken: string }>({
      query: (body) => ({
        url: "/api/auth/one-tap/callback",
        method: "POST",
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { meta } = await queryFulfilled;
          if (meta?.authToken) {
            setToken(meta.authToken);
          }
          dispatch(authApi.util.invalidateTags(["Session"]));
        } catch {
          // error handling is done by the calling component
        }
      },
    }),

    sendOtp: builder.mutation<void, { email: string }>({
      query: (body) => ({
        url: "/api/auth/email-otp/send-verification-otp",
        method: "POST",
        body: { ...body, type: "sign-in" },
      }),
    }),

    verifyOtp: builder.mutation<SessionUser, { email: string; otp: string }>({
      query: (body) => ({
        url: "/api/auth/sign-in/email-otp",
        method: "POST",
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { meta } = await queryFulfilled;
          if (meta?.authToken) {
            setToken(meta.authToken);
          }
          dispatch(authApi.util.invalidateTags(["Session"]));
        } catch {
          // error handling is done by the calling component
        }
      },
    }),

    signOut: builder.mutation<void, void>({
      query: () => ({
        url: "/api/auth/sign-out",
        method: "POST",
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        clearToken();
        dispatch(authApi.util.invalidateTags(["Session"]));
        try {
          await queryFulfilled;
        } catch {
          // error handling is done by the calling component
        }
      },
    }),
  }),
});

export const {
  useGetSessionQuery,
  useOneTapSignInMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useSignOutMutation,
} = authApi;
