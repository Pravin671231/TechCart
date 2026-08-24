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
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  R2_PUBLIC_URL_BASE: z.string().min(1, "R2_PUBLIC_URL_BASE is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().min(1, "BETTER_AUTH_URL is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().min(1, "RESEND_FROM_EMAIL is required"),
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  PORT: rawEnv.PORT,
  NODE_ENV: rawEnv.NODE_ENV,
  MONGODB_URI: rawEnv.MONGODB_URI,
  REDIS_URL: rawEnv.REDIS_URL,
  CORS_ORIGINS: rawEnv.CORS_ORIGINS,
  R2: {
    ACCOUNT_ID: rawEnv.R2_ACCOUNT_ID,
    ACCESS_KEY_ID: rawEnv.R2_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: rawEnv.R2_SECRET_ACCESS_KEY,
    BUCKET_NAME: rawEnv.R2_BUCKET_NAME,
    PUBLIC_URL_BASE: rawEnv.R2_PUBLIC_URL_BASE,
  },
  BETTER_AUTH_SECRET: rawEnv.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: rawEnv.BETTER_AUTH_URL,
  GOOGLE: {
    CLIENT_ID: rawEnv.GOOGLE_CLIENT_ID,
    CLIENT_SECRET: rawEnv.GOOGLE_CLIENT_SECRET,
  },
  RESEND: {
    API_KEY: rawEnv.RESEND_API_KEY,
    FROM_EMAIL: rawEnv.RESEND_FROM_EMAIL,
  },
};
