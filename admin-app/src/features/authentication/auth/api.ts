import { api } from "@/app/api/baseApi";
import { API_URL } from "@/config/env";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { setToken, clearToken } from "./tokenStorage";
import { getChallenge, setChallenge, clearChallenge } from "./challengeStorage";
import type { SessionUser } from "./types";

const CHALLENGE_HEADER = "x-admin-2fa-challenge";

// Resend the stored pending-challenge token on the OTP steps — the backend's
// httpOnly cookie is a dropped third-party cookie cross-site (challengeStorage.ts).
const challengeHeaders = (): Record<string, string> => {
  const challenge = getChallenge();
  return challenge ? { [CHALLENGE_HEADER]: challenge } : {};
};

// Issue #148/M3.10 — every endpoint here targets `/api/auth/*`, not
// `/api/admin/*`, so it builds an absolute URL rather than a path relative
// to baseApi.ts's ADMIN_API_BASE_URL. RTK Query's fetchBaseQuery joins an
// absolute URL through untouched (see joinUrls in @reduxjs/toolkit/query),
// so this reuses the shared `api` instance (and its bearer-token
// prepareHeaders) without touching a single existing catalog endpoint's
// relative path.
const authUrl = (path: string) => `${API_URL}/api/auth${path}`;

type GetSessionResponse = ApiSuccessEnvelope<{ user?: SessionUser | null } | null>;
type SignInPasswordResponse = ApiSuccessEnvelope<{ code?: string }>;
type VerifyOtpResponse = ApiSuccessEnvelope<{ user: SessionUser }>;

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSession: builder.query<SessionUser | null, void>({
      query: () => authUrl("/get-session"),
      transformResponse: (response: GetSessionResponse) => unwrapData(response)?.user ?? null,
      providesTags: ["Session"],
    }),

    // Admin's password step never itself establishes a session (2FA is
    // mandatory for every admin account) — it only ever returns
    // {code: "OTP_REQUIRED"} nested in `data` on success (backend's
    // auth.controller.ts adminSignInHandler). Read the flag rather than
    // assume it, in case that ever changes.
    signInPassword: builder.mutation<{ otpRequired: boolean }, { email: string; password: string }>(
      {
        query: (body) => ({ url: authUrl("/sign-in/email"), method: "POST", body }),
        transformResponse: (response: SignInPasswordResponse) => ({
          otpRequired: unwrapData(response)?.code === "OTP_REQUIRED",
        }),
        async onQueryStarted(_, { queryFulfilled }) {
          try {
            const { meta } = await queryFulfilled;
            const challenge = meta?.response?.headers.get(CHALLENGE_HEADER);
            if (challenge) setChallenge(challenge);
          } catch {
            // handled by the caller's own error state
          }
        },
      },
    ),

    // No body — the pending 2FA challenge is resolved server-side from the
    // x-admin-2fa-challenge header (stored from the password step) or, for a
    // same-origin client, the cookie. Used for both the initial send and "Resend".
    sendOtp: builder.mutation<void, void>({
      query: () => ({
        url: authUrl("/two-factor/send-otp"),
        method: "POST",
        headers: challengeHeaders(),
      }),
    }),

    verifyOtp: builder.mutation<SessionUser, { code: string }>({
      query: (body) => ({
        url: authUrl("/two-factor/verify-otp"),
        method: "POST",
        body,
        headers: challengeHeaders(),
      }),
      transformResponse: (response: VerifyOtpResponse) => unwrapData(response).user,
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { meta } = await queryFulfilled;
          const token = meta?.response?.headers.get("set-auth-token");
          if (token) setToken(token);
          clearChallenge();
          dispatch(authApi.util.invalidateTags(["Session"]));
        } catch {
          // handled by the caller's own error state
        }
      },
    }),

    signOut: builder.mutation<void, void>({
      query: () => ({ url: authUrl("/sign-out"), method: "POST" }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        clearToken();
        clearChallenge();
        dispatch(authApi.util.invalidateTags(["Session"]));
        try {
          await queryFulfilled;
        } catch {
          // token/local state is already cleared regardless of the
          // response — a failed sign-out request shouldn't leave the
          // admin stuck signed in locally.
        }
      },
    }),
  }),
});

export const {
  useGetSessionQuery,
  useSignInPasswordMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useSignOutMutation,
} = authApi;
