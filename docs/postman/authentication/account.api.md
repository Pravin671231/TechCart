# Postman Manual — TechCart Backend API (My Account)

A step-by-step guide to testing session-scoped "my own account" endpoints in Postman.

**Scope:** this document covers account self-service (`FR-AUTH-036`–`039`): a buyer profile (view/update own `name`/`phone`) and an admin change-password capability. Distinct from [`adminUsers.api.md`](./adminUsers.api.md) — this module is always "my own account," never someone else's, and its two halves have genuinely different role guards on the same mount: `GET`/`PATCH /api/account/profile` requires a **buyer** session, `POST /api/account/change-password` requires **any** admin session (`catalog-manager`, `order-manager`, or `super-admin` — not buyer-only like the profile routes, and not super-admin-only like `adminUsers.api.md`). Both are gated by `src/middleware/rbac.ts` against a session from TechCart's custom session engine (Better Auth was removed in Issues #258–#261); `POST /api/account/change-password` bcrypt-verifies `users.passwordHash` directly (Issue #259/M3.21). This module also carries `GET /api/account/dashboard` (SRS v0.7, Issue #173) — a buyer-only "my orders at a glance" read, added later but living on this same mount since it's session-scoped "my own account" data too. See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Account Self-Service and Dashboard sections for full implementation detail.

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites) plus [`auth.api.md`](./auth.api.md#prerequisites). This doc needs **both** tokens [`auth.api.md`](./auth.api.md#one-time-postman-setup) sets up, since exercising both halves (and each half's cross-role rejection) needs both a buyer and an admin session live at once:

- `buyer_access_token` — from [`auth.api.md`](./auth.api.md#buyer-sign-in)'s email-OTP (or Google One Tap) sign-in.
- `admin_access_token` — from [`auth.api.md`](./auth.api.md#admin-sign-in-password--mandatory-otp)'s password + OTP sign-in, any of the three admin roles (not super-admin-only).

---

## `GET /api/account/profile`

Views the signed-in **buyer's** own profile.

| Field  | Value                                |
| ------ | --------------------------------------- |
| Method | `GET`                                    |
| URL    | `{{base_url}}/api/account/profile`       |
| Name   | `Get My Profile (Buyer)`                 |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "buyer@example.com",
    "email": "buyer@example.com",
    "phone": "+919876543210"
  }
}
```

- `phone` is only present once set — omitted entirely (not `null`) on a brand-new account that's never called `PATCH` below.

### Error cases

**No session at all:**

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "UNAUTHENTICATED",
  "message": "Sign in required."
}
```

**An admin session** (retry with `Authorization: Bearer {{admin_access_token}}` instead):

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "This action requires one of: buyer."
}
```

These routes are buyer-only in the literal sense — even a `super-admin` session is rejected here.

---

## `PATCH /api/account/profile`

Updates the signed-in buyer's own `name` and/or `phone` (`FR-AUTH-037`) — email is out of scope for this version, and buyers have no password to change through this module.

| Field  | Value                                |
| ------ | --------------------------------------- |
| Method | `PATCH`                                  |
| URL    | `{{base_url}}/api/account/profile`       |
| Name   | `Update My Profile (Buyer)`              |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "name": "Updated Buyer Name",
  "phone": "+919876543210"
}
```

Both fields are optional individually, but **at least one is required**.

**Click Send. Expected response — `200 OK`:** the full updated profile, same shape as `GET` above.

### Error cases

**Empty body** (neither `name` nor `phone` present):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "": "At least one of name or phone is required."
  }
}
```

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as `GET` above for a missing session or a non-buyer session.

---

## `GET /api/account/dashboard`

The signed-in **buyer's** own "at a glance" dashboard — profile, 5 most recent orders, and lifetime stats (`FR-DASH-010`–`012`).

| Field  | Value                                 |
| ------ | --------------------------------------- |
| Method | `GET`                                  |
| URL    | `{{base_url}}/api/account/dashboard`   |
| Name   | `My Dashboard (Buyer)`                 |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body, no query params.

**Click Send. Expected response — `200 OK`** for a buyer with order history:

```json
{
  "success": true,
  "data": {
    "profile": { "_id": "66a1f0c9e4b0a1a2b3c4d5e6", "name": "Asha Rao", "email": "buyer@example.com", "phone": "9876543210" },
    "recentOrders": [
      {
        "id": "66d2b3c4d5e6f7a8b9c0d1e2",
        "orderNumber": "TC-2026-000001",
        "status": "paid",
        "items": [{ "...": "... see ../order-management/orders.api.md for the full item shape ..." }],
        "totalAmount": 80000,
        "statusHistory": [{ "status": "pending_payment", "at": "..." }, { "status": "paid", "at": "..." }],
        "createdAt": "2026-08-30T10:00:00.000Z"
      }
    ],
    "lifetimeOrderCount": 2,
    "lifetimeAmountSpent": 40000
  }
}
```

- `recentOrders` — up to **5** orders, newest first, the identical shape as [`../order-management/orders.api.md`](../order-management/orders.api.md#get-apiordersid)'s own detail (minus `payment`).
- `lifetimeOrderCount`/`lifetimeAmountSpent` — count/sum across **every** order that ever reached a revenue-counting status (excludes `pending_payment` and `cancelled` orders), net of any refunds against those same orders. Whole rupees, like every order-derived figure in this API.
- Cached for **60 seconds** per buyer, same mechanism as [`../dashboard/dashboard.api.md`](../dashboard/dashboard.api.md#caching).

**Expected response — `200 OK` — a brand-new buyer with zero orders (empty state, never an error):**

```json
{
  "success": true,
  "data": {
    "profile": { "_id": "66a1f0c9e4b0a1a2b3c4d5e7", "name": "New Buyer", "email": "new-buyer@example.com" },
    "recentOrders": [],
    "lifetimeOrderCount": 0,
    "lifetimeAmountSpent": 0
  }
}
```

### Error cases

Same `UNAUTHENTICATED`/`FORBIDDEN` (non-buyer session) shapes as `GET /api/account/profile` above.

---

## `POST /api/account/change-password`

Changes the signed-in **admin's** own password — requires the current password, unlike `adminUsers.api.md`'s admin-provisioned reset flow (`FR-AUTH-038`).

| Field  | Value                                            |
| ------ | ---------------------------------------------------- |
| Method | `POST`                                                |
| URL    | `{{base_url}}/api/account/change-password`            |
| Name   | `Change My Password (Admin)`                          |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "currentPassword": "the-current-password",
  "newPassword": "ANewSecret!456"
}
```

- `newPassword` — minimum 8 characters.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": { "changed": true }
}
```

- **Invalidates every *other* session for this admin, but leaves the session making this request alive** (`FR-AUTH-039`) — if you have a second bearer token for the same admin (from a separate sign-in), confirm it's now dead via `GET /api/auth/get-session` (see [`auth.api.md`](./auth.api.md#get-apiauthget-session)) while `admin_access_token` itself keeps working.
- The new password works immediately on [`auth.api.md`](./auth.api.md#post-apiauthsign-inemail)'s password step (still followed by the same mandatory OTP challenge).

### Error cases

**Wrong `currentPassword`** — rejected with one generic code, no further detail (same enumeration-safety posture as sign-in's `INVALID_EMAIL_OR_PASSWORD`); **no session is invalidated** when this happens, current or otherwise:

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "INVALID_CURRENT_PASSWORD",
  "message": "Current password is incorrect."
}
```

**A buyer session** (retry with `Authorization: Bearer {{buyer_access_token}}` instead):

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "This action requires one of: catalog-manager, order-manager, super-admin."
}
```

**No session at all:** same `401 UNAUTHENTICATED` shape as the profile routes above.

**`newPassword` under 8 characters:** same `400 VALIDATION_ERROR` shape as the profile update above, keyed on `newPassword`.

---

## Error Code Reference

| Code                       | Status | Where it comes from                                                                                          | Reachable via an existing endpoint? |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `UNAUTHENTICATED`           | 401    | `src/middleware/rbac.ts` — no session resolves from the request at all                                             | Yes                                     |
| `FORBIDDEN`                 | 403    | `src/middleware/rbac.ts` — a real session whose role isn't allowed on that specific route (buyer-only vs. admin-only) | Yes                                     |
| `VALIDATION_ERROR`          | 400    | `errorHandler.ts` — a thrown `ZodError` (empty profile-update body, `newPassword` too short)                       | Yes                                     |
| `ACCOUNT_NOT_FOUND`         | 404    | `account.service.ts` — the authenticated user's own id no longer resolves to a `users` document (a defensive, effectively unreachable case once `rbac` has resolved a real session) | No — theoretical only |
| `INVALID_CURRENT_PASSWORD`  | 401    | `account.service.ts`'s `changePassword` — the submitted `currentPassword` failed a bcrypt check against the stored `users.passwordHash` | Yes                                     |

---

## What's Not Here Yet

Buyer email/password changes and admin profile self-service (name/etc. for an admin account) aren't part of this module — `GET`/`PATCH /api/account/profile` is buyer-only, `POST /api/account/change-password` is admin-only, and neither role gets the other's capability here. Creating/listing/deactivating *other* admin accounts is a separate module — see [`adminUsers.api.md`](./adminUsers.api.md).
