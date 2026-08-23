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
  // Authorization carries the Bearer session token (Issue #139) — omitting
  // it would fail preflight for every authenticated buyer request.
  allowedHeaders: ["Content-Type", "Authorization"],
  // set-auth-token carries the Bearer session token back on sign-in
  // (Better Auth's `bearer` plugin) — without exposing it explicitly, a
  // browser receives the header but cross-origin `fetch(...).headers.get()`
  // can't read it, silently breaking the whole point of this mechanism.
  exposedHeaders: ["set-auth-token"],
});
