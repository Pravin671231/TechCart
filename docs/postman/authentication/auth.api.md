# Postman Manual — TechCart Backend API (Authentication)

A step-by-step guide to testing buyer and admin sign-in, session, and password-reset endpoints in Postman.

**Scope:** this document covers Issue #139 (M3.1 — buyer passwordless authentication, `FR-AUTH-001`–`008`, `046`), Issue #140 (M3.2 — admin password + mandatory OTP sign-in, `FR-AUTH-009`–`018`, `030`), and Issue #141 (M3.3 — admin self-service password reset, `FR-AUTH-019`–`022`). Every route below rides Better Auth's own handler (`src/lib/auth.ts`), mounted as a catch-all at `/api/auth/*` and bridged into this repo's `{success, data}` / `{success, code, message}` contract by `src/middleware/betterAuthHandler.ts` — see [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Authentication (Buyer)/(Admin)/Admin Password Reset sections for full implementation detail.

**Bearer token, not just a cookie.** `buyer-app` (Vercel) and `backend` (Render) are separate domains with no shared parent domain, so a cross-site cookie doesn't reliably survive a real deployed `fetch` — Safari blocks third-party cookies outright. Every sign-in response below also returns a `set-auth-token` response header (Better Auth's `bearer` plugin); a client resends that value as `Authorization: Bearer <token>` on every later request. This doc documents the bearer-token flow as the primary path, since it's what actually works cross-domain and what `buyer-app`/`admin-app` use — the cookie session still gets set too, and Postman's own cookie jar will carry it automatically between requests made from the same collection/agent against `localhost`, but that's a same-origin convenience, not the mechanism this system depends on.

See [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md) for `GET /health` and the general collection setup this doc assumes is already done.

---

## Prerequisites

Same as [`uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in. This module additionally needs `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`, `MAILTRAP_FROM_EMAIL` set (`src/config/env.ts` refuses to boot without them, same "all required, validated at startup" behavior as the R2 vars).

**Buyer and admin sign-in/2FA OTP codes are fixed to `123456` in every environment, including production (Issue #242/M3.14)** — a deliberate, pre-launch-only tradeoff (not a real security posture), documented in `backend/CLAUDE.md`'s Authentication (Buyer)/(Admin) sections. Submitting `123456` at any OTP-verify step below always succeeds; **no real inbox access is needed to test those flows anymore.** The password-reset *link* (`POST /api/auth/request-password-reset`, below) is unaffected — that's still a real, random token, actually emailed via Mailtrap (`src/externalService/mailer.ts`), not returned in any API response. To read that link by hand in Postman, either point `MAILTRAP_FROM_EMAIL`/your test inbox at something you can actually read (Mailtrap's own sandbox inbox works directly, no domain verification needed), or watch the backend's own console — nothing in this repo echoes the reset link back to the HTTP response. This is a real, accepted limitation of testing the reset-link step by hand, not a documentation gap.

**Fastest way to get a real admin account to sign in as:** `npm run seed:super-admin --workspace backend` (reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_NAME`/`SUPER_ADMIN_PASSWORD` from the environment — **all three required, no fallback**, since Issue #241/M3.13 — see [`adminUsers.api.md`](./adminUsers.api.md) for the alternative, API-driven provisioning path once you have one super-admin).

---

## One-Time Postman Setup

Beyond `uploads.api.md`'s `base_url` variable, add two more **empty** collection variables:

| Variable             | Initial Value    | Current Value                                        |
| --------------------- | ---------------- | ----------------------------------------------------- |
| `buyer_access_token`  | _(leave empty)_  | _(paste a buyer sign-in response's `set-auth-token`)_ |
| `admin_access_token`  | _(leave empty)_  | _(paste an admin sign-in response's `set-auth-token`)_|

There's no Postman test script wiring these up automatically — same "pure manual walkthrough, no exported collection" convention every file in this folder follows. After each sign-in call below that returns a `set-auth-token` header, copy its value into the matching variable by hand (Postman's response pane's **Headers** tab shows it) so [`adminUsers.api.md`](./adminUsers.api.md) and [`account.api.md`](./account.api.md) can reuse it.

---

## Buyer Sign-In

### `POST /api/auth/email-otp/send-verification-otp`

Requests a one-time sign-in code by email (`FR-AUTH-002`).

| Field  | Value                                              |
| ------ | --------------------------------------------------- |
| Method | `POST`                                               |
| URL    | `{{base_url}}/api/auth/email-otp/send-verification-otp` |
| Name   | `Buyer — Send OTP`                                   |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "email": "buyer@example.com",
  "type": "sign-in"
}
```

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {}
}
```

- The actual code is fixed to `123456` in every environment — submit that value at the verify step below, no need to check an inbox. See [Prerequisites](#prerequisites).
- The code expires in **10 minutes** (`FR-AUTH-007`, `emailOTP({expiresIn: 600})`).

### Error cases

**Email belongs to an already-registered admin account:**

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "GOOGLE_ACCOUNT_IS_ADMIN",
  "message": "This email belongs to an admin account. Sign in from the admin console instead."
}
```

(Despite the code's name, this same check guards the buyer email-OTP send/verify paths too, not just Google sign-in — see [Error Code Reference](#error-code-reference).)

---

### `POST /api/auth/sign-in/email-otp`

Verifies the code from the previous step and signs in — creating a new `role: "buyer"` account on first use, or resolving to the existing one by email on a return visit (`FR-AUTH-001`, `005`, `008`).

| Field  | Value                                        |
| ------ | ---------------------------------------------- |
| Method | `POST`                                         |
| URL    | `{{base_url}}/api/auth/sign-in/email-otp`      |
| Name   | `Buyer — Verify OTP`                           |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "email": "buyer@example.com",
  "otp": "123456"
}
```

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "email": "buyer@example.com",
      "name": "buyer@example.com",
      "role": "buyer",
      "emailVerified": true
    },
    "token": "raw-session-token-value...",
    "redirect": false
  }
}
```

**Response Headers tab** — copy `set-auth-token`'s value into the `buyer_access_token` collection variable (see [One-Time Postman Setup](#one-time-postman-setup)). A `Set-Cookie` header is also present; Postman's cookie jar handles it automatically if you keep testing from the same collection.

- A client-submitted `role` in the body is silently ignored — every new account is always `role: "buyer"` (`FR-AUTH-004`; `additionalFields.role` is `input: false` in `src/lib/auth.ts`).
- Signing in with the same email a second time (whether by this method or Google) resolves to the same account id, not a duplicate (`FR-AUTH-005`).

### Error cases

**Wrong or already-used code** (confirmed against Better Auth's own `emailOTP` plugin source, `atomicVerifyOTP()`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_OTP",
  "message": "Invalid OTP"
}
```

**Expired code (older than 10 minutes):**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "OTP_EXPIRED",
  "message": "OTP expired"
}
```

**More than 3 wrong attempts against the same code** (`allowedAttempts` default):

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "TOO_MANY_ATTEMPTS",
  "message": "Too many attempts"
}
```

**Email belongs to an already-registered admin account:** identical `403 GOOGLE_ACCOUNT_IS_ADMIN` as the send-OTP step — this is the one gap `validateUserInfo`'s OAuth/One-Tap check doesn't cover on its own (a *returning* OTP sign-in for an already-existing account), closed by a dedicated `hooks.before` matcher in `src/lib/auth.ts`.

---

### `POST /api/auth/one-tap/callback`

Google One Tap sign-in (`FR-AUTH-001`, `003`) — verifies a Google-issued ID token and creates/resolves a `role: "buyer"` account, identical dedup/role rules as email-OTP above.

| Field  | Value                                      |
| ------ | --------------------------------------------- |
| Method | `POST`                                        |
| URL    | `{{base_url}}/api/auth/one-tap/callback`      |
| Name   | `Buyer — Google One Tap`                      |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "idToken": "<a real Google-issued ID token>"
}
```

**Not directly testable by hand in Postman** — `idToken` must be a real, signature-valid Google ID token from an actual One Tap sign-in in a browser; there's no way to fabricate one here. Documented for completeness (shape and response match the OTP-verify response above, minus `redirect`).

### Error cases

Same `GOOGLE_ACCOUNT_IS_ADMIN` (403) as the OTP paths above, when the token's email belongs to an existing admin account.

---

### `POST /api/auth/sign-in/social` + `GET /api/auth/callback/google`

Google OAuth sign-in (`FR-AUTH-001`, `003`) — a full browser redirect flow, **not directly Postman-testable end-to-end**. Documented here for completeness only.

| Field  | Value                                                          |
| ------ | ----------------------------------------------------------------- |
| Method | `POST`                                                             |
| URL    | `{{base_url}}/api/auth/sign-in/social`                             |
| Name   | `Buyer — Start Google OAuth`                                       |

**Body tab → raw → JSON:**

```json
{
  "provider": "google",
  "callbackURL": "http://localhost:3000/"
}
```

**Response — `200 OK`:** `{"success": true, "data": {"url": "https://accounts.google.com/o/oauth2/v2/auth?...", "redirect": true}}` — `data.url` is where a real browser would be sent next. Postman can fetch this URL, but Google itself will refuse a non-interactive/scripted authorization — the round trip through Google's consent screen and back to `GET /api/auth/callback/google?state=...&code=...` needs a real browser, not something this manual carries you through.

- **Known, documented limitation** (unchanged since Issue #139): a redirect response's headers aren't readable by frontend JS the way a `fetch` response's are, so the OAuth path specifically needs its own token-exchange technique once a real sign-in UI is built — One Tap and email-OTP both get the bearer token cleanly since they're direct JSON calls.

---

## Admin Sign-In (Password + Mandatory OTP)

Two-step challenge, distinct from buyer's single-call methods — a correct password alone never establishes a session (`FR-AUTH-011`–`014`, `030`).

### `POST /api/auth/sign-in/email`

Password step.

| Field  | Value                                    |
| ------ | -------------------------------------------- |
| Method | `POST`                                        |
| URL    | `{{base_url}}/api/auth/sign-in/email`         |
| Name   | `Admin — Password Step`                       |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "email": "admin@example.com",
  "password": "the-admin-password"
}
```

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "twoFactorRedirect": true
  }
}
```

- **No session is established yet** — `GET /api/auth/get-session` right after this step still returns `data: null`. Postman needs to keep using the same request (same collection run / same cookie jar) so the two-factor challenge state (a cookie) carries into the next two calls — this doc assumes you're testing sequentially in one Postman session.

### Error cases

**Wrong password, unknown email, or an email that belongs to a `role: "buyer"` account** — all three return the identical generic error, deliberately indistinguishable (`FR-AUTH-010`, `030`):

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "INVALID_EMAIL_OR_PASSWORD",
  "message": "Invalid email or password."
}
```

No OTP is ever sent for any of these three cases.

---

### `POST /api/auth/two-factor/send-otp`

Dispatches the mandatory OTP email — only reachable after a valid password step above.

| Field  | Value                                       |
| ------ | ---------------------------------------------- |
| Method | `POST`                                          |
| URL    | `{{base_url}}/api/auth/two-factor/send-otp`     |
| Name   | `Admin — Send OTP`                              |

**Headers tab:** `Content-Type: application/json`. **Body:** `{}`.

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": {}}`. The code is fixed to `123456` in every environment — submit that at `/two-factor/verify-otp`, no need to check an inbox. See [Prerequisites](#prerequisites).

---

### `POST /api/auth/two-factor/verify-otp`

Completes sign-in.

| Field  | Value                                          |
| ------ | -------------------------------------------------- |
| Method | `POST`                                              |
| URL    | `{{base_url}}/api/auth/two-factor/verify-otp`       |
| Name   | `Admin — Verify OTP`                                |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "code": "123456"
}
```

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "token": "raw-session-token-value...",
    "user": {
      "id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "email": "admin@example.com",
      "role": "super-admin"
    }
  }
}
```

Copy `set-auth-token` (Response Headers tab) into the `admin_access_token` collection variable. The session cookie set here is `httpOnly`/`secure`/`sameSite=lax` (`FR-AUTH-015`–`016`).

### Error cases

Confirmed against Better Auth's own `twoFactor` plugin source (`otp/index.mjs`) — no session is established in any of these cases:

**Wrong code:**

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "INVALID_CODE",
  "message": "Invalid code"
}
```

**Expired code, or a reused/already-verified code** (both collapse to the same "no verification record found" check):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "OTP_HAS_EXPIRED",
  "message": "OTP has expired"
}
```

**More than 5 wrong attempts against the same code** (`allowedAttempts` default):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE",
  "message": "Too many attempts. Please request a new code."
}
```

---

## Session — Common to Buyer and Admin

### `GET /api/auth/get-session`

Resolves the current session from either a bearer token or a cookie.

| Field  | Value                                  |
| ------ | ------------------------------------------ |
| Method | `GET`                                       |
| URL    | `{{base_url}}/api/auth/get-session`         |
| Name   | `Get Session`                               |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}` (or `{{admin_access_token}}` for the admin case). No body.

**Click Send. Expected response — `200 OK`, with a valid token:**

```json
{
  "success": true,
  "data": {
    "user": { "id": "66a1f0c9e4b0a1a2b3c4d5e6", "email": "buyer@example.com", "role": "buyer" },
    "session": { "id": "...", "userId": "...", "expiresAt": "2026-08-30T10:00:00.000Z" }
  }
}
```

**With no `Authorization` header, an invalid token, or an already-signed-out token:** `200 OK`, `{"success": true, "data": null}` — this endpoint never 401s itself, it just reports "no session" as a null payload. Every other route in this codebase treats `data: null` from this call as "not signed in."

---

### `POST /api/auth/sign-out`

Invalidates the current session (cookie and/or the bearer token that made this request).

| Field  | Value                             |
| ------ | ------------------------------------- |
| Method | `POST`                                 |
| URL    | `{{base_url}}/api/auth/sign-out`       |
| Name   | `Sign Out`                             |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}` (or `{{admin_access_token}}`). **Body:** `{}`.

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": {}}`. A subsequent `GET /api/auth/get-session` with the same token now returns `data: null` (`FR-AUTH-017`).

---

## Admin Password Reset

Self-service recovery for an admin who forgets the password from the sign-in flow above (`FR-AUTH-019`–`022`) — built on Better Auth's own `emailAndPassword` reset support, not a hand-rolled token.

### `POST /api/auth/request-password-reset`

| Field  | Value                                                |
| ------ | ------------------------------------------------------- |
| Method | `POST`                                                    |
| URL    | `{{base_url}}/api/auth/request-password-reset`            |
| Name   | `Request Password Reset`                                  |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{ "email": "admin@example.com" }
```

**Click Send. Expected response — `200 OK`, regardless of what `email` resolves to:**

```json
{
  "success": true,
  "data": {}
}
```

- **No-enumeration guarantee (`FR-AUTH-019`):** a registered admin's email, a registered buyer's email, and a completely unregistered email all get this exact `200`/`{}` response — try all three and compare. The email is only actually sent for a non-buyer (admin) account; a buyer submitting their own email here gets the identical response but no email, since buyers have no password to reset.
- The reset link's token isn't parseable out of a real email in a Postman-only workflow — if you have server/log access, or control the inbox `MAILTRAP_FROM_EMAIL`/the request delivers to (Mailtrap's own sandbox inbox works directly), the emailed link carries it; otherwise this step is verifiable by response shape only, not a full round trip. Unlike the sign-in/2FA OTP codes above, this token is still real/random, not fixed — password reset was out of scope for Issue #242/M3.14's fixed-OTP change. (This repo's own test suite reads the token back from a private tracking collection instead of the email — not something available outside the codebase.)

---

### `POST /api/auth/reset-password`

| Field  | Value                                     |
| ------ | ---------------------------------------------- |
| Method | `POST`                                          |
| URL    | `{{base_url}}/api/auth/reset-password`          |
| Name   | `Reset Password`                                |

**Headers tab:** `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{
  "newPassword": "ANewSecret!789",
  "token": "<token from the reset email>"
}
```

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": {}}`.

- **Invalidates every existing session for that admin** (`FR-AUTH-022`) — a bearer token obtained before the reset stops working on the very next `GET /api/auth/get-session` call.
- The new password works immediately on [`POST /api/auth/sign-in/email`](#post-apiauthsign-inemail) above (still followed by the same mandatory OTP step — no bypass).

### Error cases

**Expired token** (1-hour expiry, `resetPasswordTokenExpiresIn: 3600`) or **an already-used token** (confirmed against Better Auth's own `resetPassword` endpoint source, `api/routes/password.mjs` — both collapse to the same "no verification record found" check):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_TOKEN",
  "message": "Invalid token"
}
```

---

## Error Code Reference

| Code                                  | Status  | Where it comes from                                                                                  | Reachable via an existing endpoint? |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `GOOGLE_ACCOUNT_IS_ADMIN`              | 403     | `src/lib/auth.ts`'s `rejectIfNonBuyerEmail`/`rejectAdminEmailOnReturningOtpSignIn` — a buyer sign-in attempt (any method) on an email already registered as a non-buyer account | Yes                                   |
| `INVALID_EMAIL_OR_PASSWORD`            | 401     | `src/lib/auth.ts`'s `rejectBuyerOnPasswordSignIn`, or Better Auth's own `/sign-in/email` — wrong password, unknown email, or a `role:"buyer"` account, all indistinguishable | Yes                                   |
| `INVALID_OTP`                          | 400     | Better Auth's `emailOTP` plugin (`atomicVerifyOTP`) — buyer OTP verify, wrong or already-consumed code | Yes                                   |
| `OTP_EXPIRED`                          | 400     | Better Auth's `emailOTP` plugin — buyer OTP verify, code older than its 10-minute expiry               | Yes                                   |
| `TOO_MANY_ATTEMPTS`                    | 403     | Better Auth's `emailOTP` plugin — buyer OTP verify, more than 3 wrong attempts against the same code   | Yes                                   |
| `INVALID_CODE`                         | 401     | Better Auth's `twoFactor` plugin's `otp` sub-plugin — admin OTP verify, wrong code                      | Yes                                   |
| `OTP_HAS_EXPIRED`                      | 400     | Better Auth's `twoFactor` plugin — admin OTP verify, code expired or already consumed                  | Yes                                   |
| `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`   | 400     | Better Auth's `twoFactor` plugin — admin OTP verify, more than 5 wrong attempts against the same code  | Yes                                   |
| `INVALID_TOKEN`                        | 400     | Better Auth's `emailAndPassword` plugin (`resetPassword` endpoint) — reset token expired or already used | Yes                                   |
| `AUTH_ERROR`                           | varies  | `src/middleware/betterAuthHandler.ts`'s fallback — any Better Auth error whose own JSON body has no `code` key, not otherwise enumerated above | Not directly — every error case this doc names above has a real, more specific code |

Every code above except `AUTH_ERROR` was confirmed by reading the installed `better-auth`/`@better-auth/core` package source directly (`node_modules/better-auth/dist/plugins/{email-otp,two-factor}/`, `node_modules/better-auth/dist/api/routes/password.mjs`), not guessed — an earlier version of this doc labeled all of these generically as `AUTH_ERROR`, which was inaccurate. Every other backend module's error contract (`VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR` — see [`uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference)) is produced by this repo's own `errorHandler.ts`, which never runs for `/api/auth/*` — every response on this page instead comes from Better Auth's own handler, reshaped into `{success, code, message}` by `betterAuthHandler.ts`. That bridge always includes a `code`; `AUTH_ERROR` is only ever a fallback for a genuinely code-less Better Auth error body, not a case this doc has otherwise named.

---

## What's Not Here Yet

Rate limiting on any of the endpoints above (`FR-AUTH-040`–`041`, Upstash Redis) is still explicitly deferred — no Redis dependency exists in this codebase yet. Admin account provisioning (creating a further admin over the API, `FR-AUTH-024`–`029`) and "my own account" self-service (buyer profile, admin change-password, `FR-AUTH-036`–`039`) are covered in [`adminUsers.api.md`](./adminUsers.api.md) and [`account.api.md`](./account.api.md) respectively — not this file.
