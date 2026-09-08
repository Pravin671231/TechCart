import cors from "cors";
import { env } from "@/config/env";
import { matchesOrigin } from "@/utils/originMatch";

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // No Origin header (server-to-server, curl, same-origin) — nothing to
    // check against an allowlist built for browser cross-origin requests.
    if (!origin || matchesOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  // Authorization carries the Bearer session token (Issue #139).
  // x-admin-2fa-challenge carries the admin pending-challenge token back to
  // the two OTP steps for a cross-site client (see lib/adminChallenge.ts) —
  // omitting either would fail preflight for those requests.
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-2fa-challenge"],
  // set-auth-token carries the Bearer session token back on sign-in;
  // x-admin-2fa-challenge carries the admin pending-challenge token back on
  // the password step — without exposing them explicitly, a browser receives
  // the header but cross-origin `fetch(...).headers.get()` can't read it,
  // silently breaking the whole point of the mechanism.
  exposedHeaders: ["set-auth-token", "x-admin-2fa-challenge"],
});
