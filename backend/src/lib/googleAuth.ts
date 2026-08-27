import { OAuth2Client } from "google-auth-library";
import { env } from "@/config/env";

// Verifies a Google ID token directly against Google's public JWKS for
// buyer One Tap sign-in (Issue #258/M3.20) — replaced Better Auth's `google`
// social-provider plugin. Uses the existing GOOGLE_CLIENT_ID env var.

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
