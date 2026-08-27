# Postman Manual — TechCart Backend API (Authentication)

A step-by-step guide to testing buyer and admin sign-in, session, and password-reset endpoints in Postman.

**Scope:** this document covers buyer passwordless authentication (`FR-AUTH-001`–`008`, `046`), admin password + mandatory OTP sign-in (`FR-AUTH-009`–`018`, `030`), and admin self-service password reset (`FR-AUTH-019`–`022`). Every `/api/auth/*` route is hand-rolled on TechCart's own custom session/OTP engine (`src/modules/authentication/auth/{routes,controller,service,repository}.ts` on top of `src/lib/{session,jwt,otp,googleAuth,password,adminChallenge}.ts`) — Better Auth was replaced entirely by Issues #258–#261/M3.19–23, and `src/lib/auth.ts` / `src/middleware/betterAuthHandler.ts` no longer exist. See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Authentication (Buyer)/(Admin)/Admin Password Reset sections for full implementation detail. Every request/response shape below was cross-checked against `backend/__tests__/authentication/**` (Supertest suites that boot the real Express app + a real in-memory MongoDB), verified against Issue #264/M3.26.

**Bearer token, not just a cookie.** `buyer-app` (Vercel) and `backend` (Render) are separate domains with no shared parent domain, so a cross-site cookie doesn't reliably survive a real deployed `fetch` — Safari blocks third-party cookies outright. Every sign-in response below also returns a `set-auth-token` response header (`src/lib/session.ts` issues the session as both a cookie and this header); a client resends that value as `Authorization: Bearer <token>` on every later request. This doc documents the bearer-token flow as the primary path, since it's what actually works cross-domain and what `buyer-app`/`admin-app` use — the cookie session still gets set too, and Postman's own cookie jar will carry it automatically between requests made from the same collection/agent against `localhost`, but that's a same-origin convenience, not the mechanism this system depends on.

See [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md) for `GET /health` and the general collection setup this doc assumes is already done.

---

## Prerequisites

Same as [`uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in. This module additionally needs `JWT_SECRET` (≥32 chars — the sole token-signing secret), `APP_BASE_URL` (the backend's own public URL; `https://` there switches the session/2FA cookies to `SameSite=None; Secure`), `REDIS_URL` (Upstash Redis-protocol string, for the auth rate limiters), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`, `MAILTRAP_FROM_EMAIL` set (`src/config/env.ts` refuses to boot without them, same "all required, validated at startup" behavior as the R2 vars). `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` no longer exist — Issue #261/M3.23 removed them (`APP_BASE_URL` is the rename of the latter).

**Buyer and admin sign-in/2FA OTP codes are fixed to `123456` in every environment, including production (Issue #242/M3.14)** — a deliberate, pre-launch-only tradeoff (not a real security posture), documented in `backend/CLAUDE.md`'s Authentication (Buyer)/(Admin) sections. Submitting `123456` at any OTP-verify step below always succeeds; **no real inbox access is needed to test those flows anymore.** The password-reset *link* (`POST /api/auth/request-password-reset`, below) is unaffected — that's still a real, random token, actually emailed via Mailtrap (`src/externalService/mailer.ts`), not returned in any API response. To read that link by hand in Postman, either point `MAILTRAP_FROM_EMAIL`/your test inbox at something you can actually read (Mailtrap's own sandbox inbox works directly, no domain verification needed), or watch the backend's own console — nothing in this repo echoes the reset link back to the HTTP response. This is a real, accepted limitation of testing the reset-link step by hand, not a documentation gap.

**Fastest way to get a real admin account to sign in as:** `npm run seed:super-admin --workspace backend` (reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_NAME`/`SUPER_ADMIN_PASSWORD` from the environment — **all three required, no fallback**, since Issue #241/M3.13 — see [`adminUsers.api.md`](./adminUsers.api.md) for the alternative, API-driven provisioning path once you have one super-admin).

---

## One-Time Postman Setup

Beyond `uploads.api.md`'s `base_url` variable, add two more **empty** collection variables:

| Variable             | Initial Value    | Current Value                                        |
| --------------------- | ---------------- | ----------------------------------------------------- |
| `buyer_access_token`  | _(leave empty)_  | _(paste a buyer sign-in response's `set-auth-token`)_ |
| `admin_access_token`  | _(leave empty)_  | _(paste an admin sign-in response's `set-auth-token`)_|

There's no Postman test script wiring these up automatically — same "pure manual walkthrough, no exported collection" convention every file in this folder follows. After each sign-in call below that returns a `set-auth-token` header, copy its value into the matching variable by hand (Postman's response pane's **Headers** tab shows it). `admin_access_token` is what [`adminUsers.api.md`](./adminUsers.api.md), [`account.api.md`](./account.api.md), and every `../product-catalog/*.api.md` admin request send as `Authorization: Bearer {{admin_access_token}}`; a session token expires on a rolling 30-day window, so re-run the admin sign-in to refresh it if requests start returning `401 UNAUTHENTICATED`.

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
  "data": null
}
```

- The actual code is fixed to `123456` in every environment — submit that value at the verify step below, no need to check an inbox. See [Prerequisites](#prerequisites).
- The code expires in **10 minutes** (`FR-AUTH-007`, `src/lib/otp.ts`'s `OTP_TTL_MS`).

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

(Despite the code's name, `auth.service.ts`'s `rejectIfNonBuyer` guards every buyer sign-in path — email-OTP send **and** verify, and One Tap — not just Google sign-in. See [Error Code Reference](#error-code-reference).)

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
    "id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "buyer@example.com",
    "email": "buyer@example.com",
    "role": "buyer"
  }
}
```

- `data` is the session user directly — `{ id, name, email, role }`, plus `phone` once the buyer sets one via [`account.api.md`](./account.api.md#patch-apiaccountprofile). There is no `token`/`redirect` wrapper (that was Better Auth's shape); the session token is delivered only via the `set-auth-token` header and the session cookie.
- **Response Headers tab** — copy `set-auth-token`'s value into the `buyer_access_token` collection variable (see [One-Time Postman Setup](#one-time-postman-setup)). A `Set-Cookie: techcart_session=…` header is also present; Postman's cookie jar handles it automatically if you keep testing from the same collection.
- A client-submitted `role` in the body is silently ignored — every new account is always `role: "buyer"` (`FR-AUTH-004`; `auth.repository.ts`'s `createBuyer` always writes `role: "buyer"`).
- Signing in with the same email a second time (whether by this method or Google One Tap) resolves to the same account id, not a duplicate (`FR-AUTH-005`).

### Error cases

**Wrong or already-consumed code** (`auth.service.ts`'s `verifyBuyerOtp` → `otp.ts`'s `verifyOtp`; a wrong code and a reused one are deliberately indistinguishable):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_OTP",
  "message": "Incorrect or expired code."
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
  "message": "This code has expired. Request a new one."
}
```

There is **no per-code attempt limit** — `otp.ts` only hashes-and-compares. Hammering the endpoint instead trips the per-IP / per-email rate limiter (`429 RATE_LIMITED`, see [Error Code Reference](#error-code-reference)).

**Email belongs to an already-registered admin account:** identical `403 GOOGLE_ACCOUNT_IS_ADMIN` as the send-OTP step — `auth.service.ts`'s `rejectIfNonBuyer` runs first on both the send and the verify path.

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

**Not directly testable by hand in Postman** — `idToken` must be a real, signature-valid Google ID token from an actual One Tap sign-in in a browser (`src/lib/googleAuth.ts` verifies it against Google's public JWKS); there's no way to fabricate one here. Documented for completeness — the success response is the bare session-user object, identical shape to the email-OTP verify response above, plus the `set-auth-token` header.

### Error cases

Same `GOOGLE_ACCOUNT_IS_ADMIN` (403) as the OTP paths above, when the token's email belongs to an existing admin account. An unverifiable token returns `401 INVALID_GOOGLE_TOKEN`.

---

### Google OAuth full-page redirect — **not available**

The full-page Google OAuth redirect flow (`POST /api/auth/sign-in/social` + `GET /api/auth/callback/google`) was **not rebuilt** on the custom session engine — Issue #258/M3.20 only ported the direct-JSON buyer paths (One Tap + email OTP), and Issue #260/M3.22 removed the Better Auth catch-all that used to serve those routes. Both now return `404 NOT_FOUND`. One Tap and email OTP are the only buyer sign-in paths.

---

## Admin Sign-In (Password + Mandatory OTP)

Two-step challenge, distinct from buyer's single-call methods — a correct password alone never establishes a session (`FR-AUTH-011`–`014`, `030`). Since Issue #259/M3.21 this is a hand-rolled flow on the custom session engine (no Better Auth). The "which admin is mid-sign-in" state between the three calls rides an `httpOnly` cookie named `techcart_admin_2fa` (`SameSite=None; Secure` when the backend runs over HTTPS, `SameSite=Lax` otherwise) — Postman must keep the same cookie jar across all three calls.

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
    "code": "OTP_REQUIRED"
  }
}
```

- **No session is established yet** — `GET /api/auth/get-session` right after this step still returns `data: null`. A `Set-Cookie: techcart_admin_2fa=…` header carries the pending challenge into the next two calls. **No OTP email is sent by this step** — the next call (`/two-factor/send-otp`) mints and sends it.

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

**A deactivated admin account** (`status: false`) — checked ahead of the password, so this is returned even for a wrong password:

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "ACCOUNT_DEACTIVATED",
  "message": "This account has been deactivated."
}
```

No challenge cookie is set, and no OTP is ever sent, for any of these cases.

---

### `POST /api/auth/two-factor/send-otp`

Mints + sends the OTP email for the pending challenge. Used for the initial send **and** "Resend".

| Field  | Value                                       |
| ------ | ---------------------------------------------- |
| Method | `POST`                                          |
| URL    | `{{base_url}}/api/auth/two-factor/send-otp`     |
| Name   | `Admin — Send OTP`                              |

**Headers tab:** none required (no body). The `techcart_admin_2fa` cookie from the password step must be sent — Postman does this automatically within one cookie jar.

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": {}}`. The code is fixed to `123456` in every environment — submit that at `/two-factor/verify-otp`, no need to check an inbox. See [Prerequisites](#prerequisites).

**Error — missing or expired challenge cookie:**

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "INVALID_TWO_FACTOR_COOKIE",
  "message": "Your sign-in session has expired. Start again."
}
```

---

### `POST /api/auth/two-factor/verify-otp`

Completes sign-in.

| Field  | Value                                          |
| ------ | -------------------------------------------------- |
| Method | `POST`                                              |
| URL    | `{{base_url}}/api/auth/two-factor/verify-otp`       |
| Name   | `Admin — Verify OTP`                                |

**Headers tab:** `Content-Type: application/json`. The `techcart_admin_2fa` cookie must be sent.

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
    "user": {
      "id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Admin Name",
      "email": "admin@example.com",
      "role": "super-admin"
    }
  }
}
```

Copy `set-auth-token` (Response Headers tab) into the `admin_access_token` collection variable — that's the bearer token for every `/api/admin/*` and `/api/account/*` call. The session cookie set here is `techcart_session` (`httpOnly`, `SameSite=Lax` over HTTP / `None; Secure` over HTTPS) (`FR-AUTH-015`–`016`). The `techcart_admin_2fa` challenge cookie is cleared.

### Error cases

No session is established in any of these cases:

**Wrong code, or a reused/already-consumed code:**

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "INVALID_CODE",
  "message": "Incorrect or expired code."
}
```

**Expired code** (older than 10 minutes):

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "OTP_HAS_EXPIRED",
  "message": "This code has expired. Request a new one."
}
```

**Missing or expired challenge cookie:** `401` `INVALID_TWO_FACTOR_COOKIE` (same shape as `/two-factor/send-otp` above).

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
    "user": {
      "id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "buyer@example.com",
      "email": "buyer@example.com",
      "role": "buyer"
    }
  }
}
```

- `data.user` is the same session-user shape the sign-in responses return (`+ phone` if set). There is **no `session` key** — `auth.controller.ts`'s `getSessionHandler` returns `{ user }` only.

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

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": null}`. Idempotent — a missing or already-invalid token is still a `200`. A subsequent `GET /api/auth/get-session` with the same token now returns `data: null` (`FR-AUTH-017`).

---

## Admin Password Reset

Self-service recovery for an admin who forgets the password from the sign-in flow above (`FR-AUTH-019`–`022`). Both endpoints are hand-rolled in `auth.service.ts` on the custom session engine, against a private `passwordResetTokens` collection.

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
  "data": { "status": "ok" }
}
```

- **No-enumeration guarantee (`FR-AUTH-019`):** a registered admin's email, a registered buyer's email, and a completely unregistered email all get this exact `200` / `{ "status": "ok" }` response — try all three and compare. The email is only actually sent for a non-buyer (admin) account; a buyer submitting their own email here gets the identical response but no email, since buyers have no password to reset.
- The reset link is `<CORS_ORIGINS[0] or APP_BASE_URL>/reset-password?token=<token>` — the `token` query param is what `POST /api/auth/reset-password` needs. Unlike the sign-in/2FA OTP codes above, this token is a real 32-byte random value, not fixed. In a Postman-only workflow it's verifiable by response shape only unless you can read the Mailtrap inbox the email delivers to (or the backend console).

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

**Click Send. Expected response — `200 OK`:** `{"success": true, "data": { "status": "ok" }}`.

- **Invalidates every existing session for that admin** (`FR-AUTH-022`) — a bearer token obtained before the reset stops working on the very next `GET /api/auth/get-session` call.
- The new password works immediately on [`POST /api/auth/sign-in/email`](#post-apiauthsign-inemail) above (still followed by the same mandatory OTP step — no bypass).

### Error cases

**Expired token** (1-hour expiry) or **an already-used token** — both collapse to the same "no live token" check:

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_RESET_TOKEN",
  "message": "This reset link is invalid or has expired."
}
```

---

## Error Code Reference

| Code                                  | Status  | Where it comes from                                                                                  | Reachable via an existing endpoint? |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `GOOGLE_ACCOUNT_IS_ADMIN`              | 403     | `auth.service.ts`'s `rejectIfNonBuyer` — a buyer sign-in attempt (One Tap, or email-OTP send **or** verify) on an email already registered as a non-buyer account | Yes                                   |
| `INVALID_GOOGLE_TOKEN`                 | 401     | `auth.service.ts`'s `signInWithGoogle` — the One Tap `idToken` failed JWKS verification (`src/lib/googleAuth.ts`) | Only with a real, invalid Google token |
| `INVALID_EMAIL_OR_PASSWORD`            | 401     | `auth.service.ts`'s `adminPasswordSignIn` (`/sign-in/email`) — wrong password, unknown email, or a `role:"buyer"` account, all indistinguishable | Yes                                   |
| `ACCOUNT_DEACTIVATED`                  | 403     | `auth.service.ts` — `/sign-in/email` for an admin whose `status` is `false` (checked ahead of the password); also the buyer OTP-request path                | Yes                                   |
| `INVALID_TWO_FACTOR_COOKIE`            | 401     | `auth.controller.ts` — `/two-factor/send-otp` or `/verify-otp` with no valid `techcart_admin_2fa` challenge cookie | Yes                                   |
| `INVALID_OTP`                          | 400     | `auth.service.ts`'s `verifyBuyerOtp` → `src/lib/otp.ts`'s `verifyOtp` — buyer OTP verify, wrong or already-consumed code | Yes                                   |
| `OTP_EXPIRED`                          | 400     | `auth.service.ts`'s `verifyBuyerOtp` — buyer OTP verify, code older than its 10-minute expiry           | Yes                                   |
| `INVALID_CODE`                         | 401     | `auth.service.ts`'s `adminVerifyOtp` — admin OTP verify, wrong or reused code                           | Yes                                   |
| `OTP_HAS_EXPIRED`                      | 401     | `auth.service.ts`'s `adminVerifyOtp` — admin OTP verify, code older than 10 minutes                    | Yes                                   |
| `INVALID_RESET_TOKEN`                  | 400     | `auth.service.ts`'s `resetAdminPassword` — `/reset-password` token expired or already used             | Yes                                   |
| `RATE_LIMITED`                         | 429     | `auth.service.ts`'s `consumeIpLimit`/`consumeEmailLimit` (`src/lib/rateLimit.ts`) — per-IP / per-email limit tripped on any buyer OTP, admin sign-in, OTP, or reset-request path | Yes                                   |

Every code above is produced by this repo's own hand-rolled `auth.service.ts` / `auth.controller.ts` / `src/lib/otp.ts`, routed through `errorHandler.ts`'s `AppError` path like every other module's error contract. The buyer OTP codes (`INVALID_OTP` / `OTP_EXPIRED`) and the admin OTP codes (`INVALID_CODE` / `OTP_HAS_EXPIRED`) are deliberately different literal values, one flow's error never mistaken for the other's. There is no per-code attempt counter (the retired `TOO_MANY_ATTEMPTS`) and no generic `AUTH_ERROR` fallback (the retired `betterAuthHandler.ts`) any more.

---

## What's Not Here Yet

Admin account provisioning (creating a further admin over the API, `FR-AUTH-024`–`029`) and "my own account" self-service (buyer profile, admin change-password, `FR-AUTH-036`–`039`) are covered in [`adminUsers.api.md`](./adminUsers.api.md) and [`account.api.md`](./account.api.md) respectively — not this file.
