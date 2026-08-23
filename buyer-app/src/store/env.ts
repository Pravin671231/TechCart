import { z } from "zod";

// NEXT_PUBLIC_API_URL is inlined by Next.js at compile time via static
// string replacement of this exact `process.env.NEXT_PUBLIC_API_URL`
// expression — do not destructure or access it dynamically, or Next
// won't be able to replace it in the compiled bundle.
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1, "NEXT_PUBLIC_API_URL is required"),
  // Google Identity Services (One Tap + the "Sign in with Google" button,
  // Issue #146/M3.8) needs its own public client ID — distinct from
  // backend's server-side GOOGLE_CLIENT_ID/SECRET, and not itself a secret.
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1, "NEXT_PUBLIC_GOOGLE_CLIENT_ID is required"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
});

if (!parsed.success) {
  throw new Error(
    "Missing required NEXT_PUBLIC_* env vars. Copy buyer-app/.env.example to " +
      "buyer-app/.env.local and fill them in (local dev API URL default: http://localhost:4000).",
  );
}

export const NEXT_PUBLIC_API_URL = parsed.data.NEXT_PUBLIC_API_URL;
export const NEXT_PUBLIC_GOOGLE_CLIENT_ID = parsed.data.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
