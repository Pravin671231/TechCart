import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { ADMIN_API_BASE_URL } from "@/config/env";
import { getToken } from "@/features/auth/tokenStorage";

// Issue #148/M3.10 — replaces the X-Admin-Key prompt entirely with real
// Better Auth sessions. `credentials: "include"` is needed only for the
// brief cross-site two-factor pending-challenge cookie window between
// POST /sign-in/email and POST /two-factor/verify-otp (see backend's
// src/lib/auth.ts for the matching SameSite=None/Secure cookie fix) —
// every other request here is authenticated purely via the bearer token
// below, cookies are otherwise unused.
export const baseQuery = fetchBaseQuery({
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
