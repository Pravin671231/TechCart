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
  ADMIN_API_KEY: z.string().min(1, "ADMIN_API_KEY is required"),
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  R2_PUBLIC_URL_BASE: z.string().min(1, "R2_PUBLIC_URL_BASE is required"),
});

const rawEnv = envSchema.parse(process.env);

export const env = {
  PORT: rawEnv.PORT,
  NODE_ENV: rawEnv.NODE_ENV,
  MONGODB_URI: rawEnv.MONGODB_URI,
  ADMIN_API_KEY: rawEnv.ADMIN_API_KEY,
  R2: {
    ACCOUNT_ID: rawEnv.R2_ACCOUNT_ID,
    ACCESS_KEY_ID: rawEnv.R2_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: rawEnv.R2_SECRET_ACCESS_KEY,
    BUCKET_NAME: rawEnv.R2_BUCKET_NAME,
    PUBLIC_URL_BASE: rawEnv.R2_PUBLIC_URL_BASE,
  },
};
