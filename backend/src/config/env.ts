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
});

export const env = envSchema.parse(process.env);
