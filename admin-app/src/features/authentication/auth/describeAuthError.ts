import { getApiErrorEnvelope } from "@/app/api/apiError";

// Shared by PasswordSignIn/OtpVerify (Issue #148/M3.10) — maps the real
// backend codes to a distinct, friendly message per state. The custom auth
// engine (Issues #258–#261, verified against in #263) throws all of these
// from auth.service.ts / auth.controller.ts. Falls back to the envelope's
// own message, then a generic string, for anything not named here (e.g. a
// plain VALIDATION_ERROR).
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  ACCOUNT_DEACTIVATED: "This account has been deactivated. Contact a super admin.",
  RATE_LIMITED: "Too many attempts. Please wait a while before trying again.",
  // Admin 2FA wrong/expired-OTP codes — deliberately distinct values from
  // buyer's INVALID_OTP/OTP_EXPIRED (auth.service.ts's adminVerifyOtp).
  INVALID_CODE: "The code you entered is incorrect. Please try again.",
  OTP_HAS_EXPIRED: "This code has expired. Request a new one.",
  // Thrown when the pending-challenge cookie (techcart_admin_2fa) is
  // missing/invalid/expired — its 10-minute window lapsed, or a cross-site
  // request never carried it — start the sign-in over from the password step.
  INVALID_TWO_FACTOR_COOKIE: "Your verification session expired. Please sign in again.",
};

export function describeAuthError(error: unknown, fallback: string): string {
  const envelope = getApiErrorEnvelope(error);
  if (!envelope) return fallback;
  return MESSAGES[envelope.code] ?? envelope.message ?? fallback;
}
