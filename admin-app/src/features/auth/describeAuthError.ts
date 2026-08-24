import { getApiErrorEnvelope } from "@/app/api/apiError";

// Shared by PasswordSignIn/OtpVerify (Issue #148/M3.10) — maps the real
// backend codes (confirmed during #145/M3.7, not the SRS/issue's
// illustrative names) to a distinct, friendly message per state. Falls back
// to the envelope's own message, then a generic string, for anything not
// named here (e.g. a plain VALIDATION_ERROR).
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  ACCOUNT_DEACTIVATED: "This account has been deactivated. Contact a super admin.",
  RATE_LIMITED: "Too many attempts. Please wait a while before trying again.",
  // Admin's twoFactor plugin's own wrong/expired-OTP codes — distinct from
  // buyer's INVALID_OTP/OTP_EXPIRED (confirmed during #145/M3.7).
  INVALID_CODE: "The code you entered is incorrect. Please try again.",
  OTP_HAS_EXPIRED: "This code has expired. Request a new one.",
  // Better Auth's twoFactor plugin's own error when the pending-challenge
  // cookie is missing/invalid/expired (e.g. the challenge's 10-minute
  // window lapsed) — start the sign-in over from the password step.
  INVALID_TWO_FACTOR_COOKIE: "Your verification session expired. Please sign in again.",
};

export function describeAuthError(error: unknown, fallback: string): string {
  const envelope = getApiErrorEnvelope(error);
  if (!envelope) return fallback;
  return MESSAGES[envelope.code] ?? envelope.message ?? fallback;
}
