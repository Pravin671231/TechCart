import dotenv from "dotenv";
import { z } from "zod";

const NODE_ENV = process.env.NODE_ENV ?? "development";

// Mode-specific file first (.env.development / .env.test / .env.production),
// then the shared .env fills in anything the mode file didn't set.
// dotenv never overwrites a key already present in process.env, so this is
// layered, not overridden: real environment variables (e.g. from CI or a
// hosting platform) always win over either file.
dotenv.config({ path: `.env.${NODE_ENV}` });
dotenv.config({ path: ".env" });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  // Rate limiting on the auth surface (FR-AUTH-040–044). Default on. Set to
  // "false" to turn every auth limiter into a no-op — a local-dev / manual
  // Postman-testing escape hatch. Must stay "true" in a real deployment.
  RATE_LIMITING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  // Optional. Only used when RATE_LIMITING_ENABLED is true: with it, the auth
  // limiters are Redis-backed (shared across instances); without it they fall
  // back to per-instance in-memory counters (RateLimiterMemory), same as
  // under test. The backend boots fine without it.
  REDIS_URL: z.string().min(1).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  R2_PUBLIC_URL_BASE: z.string().min(1, "R2_PUBLIC_URL_BASE is required"),
  // Razorpay (M6/SRS v0.6). Dummy values are fine for automated tests — only
  // HMAC signature verification (payments.service.ts) is exercised for real
  // against these; the Razorpay SDK's own network calls are mocked in every
  // test. Real test-mode keys are added later via .env for manual E2E.
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1, "RAZORPAY_WEBHOOK_SECRET is required"),
  // The backend's own public base URL. `.startsWith("https://")` gates the
  // cross-site cookie attributes (session.ts / adminChallenge.ts) and it's
  // the fallback origin for admin password-reset links (auth.service.ts).
  APP_BASE_URL: z.string().min(1, "APP_BASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  // TEMPORARY (see mailer.ts's own header comment) — reverted from
  // Issue #242/M3.14's "all five required" back to optional so the backend
  // boots without real Mailtrap credentials configured. Revert this back to
  // .min(1)-required once real credentials are available; this is a
  // short-lived local-dev workaround, not a permanent design change.
  MAILTRAP_HOST: z.string().optional(),
  MAILTRAP_PORT: z.coerce.number().optional(),
  MAILTRAP_USER: z.string().optional(),
  MAILTRAP_PASS: z.string().optional(),
  MAILTRAP_FROM_EMAIL: z.string().optional(),
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  PORT: rawEnv.PORT,
  NODE_ENV: rawEnv.NODE_ENV,
  MONGODB_URI: rawEnv.MONGODB_URI,
  RATE_LIMITING_ENABLED: rawEnv.RATE_LIMITING_ENABLED,
  REDIS_URL: rawEnv.REDIS_URL,
  CORS_ORIGINS: rawEnv.CORS_ORIGINS,
  R2: {
    ACCOUNT_ID: rawEnv.R2_ACCOUNT_ID,
    ACCESS_KEY_ID: rawEnv.R2_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: rawEnv.R2_SECRET_ACCESS_KEY,
    BUCKET_NAME: rawEnv.R2_BUCKET_NAME,
    PUBLIC_URL_BASE: rawEnv.R2_PUBLIC_URL_BASE,
  },
  RAZORPAY: {
    KEY_ID: rawEnv.RAZORPAY_KEY_ID,
    KEY_SECRET: rawEnv.RAZORPAY_KEY_SECRET,
    WEBHOOK_SECRET: rawEnv.RAZORPAY_WEBHOOK_SECRET,
  },
  APP_BASE_URL: rawEnv.APP_BASE_URL,
  JWT_SECRET: rawEnv.JWT_SECRET,
  GOOGLE: {
    CLIENT_ID: rawEnv.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: rawEnv.GOOGLE_CLIENT_SECRET,
  },
  MAILTRAP: {
    HOST: rawEnv.MAILTRAP_HOST,
    PORT: rawEnv.MAILTRAP_PORT,
    USER: rawEnv.MAILTRAP_USER,
    PASS: rawEnv.MAILTRAP_PASS,
    FROM_EMAIL: rawEnv.MAILTRAP_FROM_EMAIL,
  },
};
