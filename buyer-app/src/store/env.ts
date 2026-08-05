import { z } from "zod";

// NEXT_PUBLIC_API_URL is inlined by Next.js at compile time via static
// string replacement of this exact `process.env.NEXT_PUBLIC_API_URL`
// expression — do not destructure or access it dynamically, or Next
// won't be able to replace it in the compiled bundle.
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().min(1, "NEXT_PUBLIC_API_URL is required"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL. Copy buyer-app/.env.example to " +
      "buyer-app/.env.local and set it (local dev default: http://localhost:4000).",
  );
}

export const NEXT_PUBLIC_API_URL = parsed.data.NEXT_PUBLIC_API_URL;
