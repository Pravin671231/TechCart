// The admin 2FA pending-challenge token (backend Issue #259/M3.21), carried
// between the password step and the OTP steps. The backend delivers it two
// ways — an httpOnly `techcart_admin_2fa` cookie and an `x-admin-2fa-challenge`
// response header — but the cookie is a third-party cookie from this app's
// origin and Safari/Chrome drop it, exactly like the session cookie
// (tokenStorage.ts). So we read the header value here and resend it as the
// same header on `two-factor/send-otp` and `verify-otp` (auth/api.ts).
//
// sessionStorage, not localStorage: the challenge is a ~10-minute transient
// with no reason to outlive the tab, unlike the session bearer token.
const CHALLENGE_KEY = "techcart_admin_2fa_challenge";

export function getChallenge(): string | null {
  return sessionStorage.getItem(CHALLENGE_KEY);
}

export function setChallenge(token: string): void {
  sessionStorage.setItem(CHALLENGE_KEY, token);
}

export function clearChallenge(): void {
  sessionStorage.removeItem(CHALLENGE_KEY);
}
