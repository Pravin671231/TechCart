import { OAuth2Client } from "google-auth-library";
import { env } from "@/config/env";

// Replaces Better Auth's `google` social-provider plugin for buyer sign-in
// (Issue #258/M3.20) — verifies a Google ID token directly against Google's
// public JWKS instead of delegating to a plugin. GOOGLE_CLIENT_ID is the
// same var Better Auth's still-running admin-side config also declares
// (Issue #139) — no new env var needed.

const client = new OAuth2Client(env.GOOGLE.CLIENT_ID);

export interface GoogleIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE.CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) return null;
    return {
      email: payload.email,
      name: payload.name ?? payload.email,
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}
