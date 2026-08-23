# Postman Manual — TechCart Backend API (Admin User Provisioning)

A step-by-step guide to testing admin account provisioning in Postman.

**Scope:** this document covers Issue #142 (M3.4 — admin account provisioning, `FR-AUTH-024`–`029`): a super-admin can create, list, and update further admin accounts over REST. Admin-only, no public/buyer surface — every route below requires a real session for a `role: "super-admin"` account (`rbac(["super-admin"])`, `src/middleware/rbac.ts`), not just any admin role. See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Admin Account Provisioning section for full implementation detail.

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites) plus [`auth.api.md`](./auth.api.md#prerequisites) — backend running, `.env` filled in (including the auth-specific vars `auth.api.md` lists).

You need a real **super-admin** session before anything here works:

1. Run `npm run seed:super-admin --workspace backend` once (reads `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_NAME`/`SUPER_ADMIN_PASSWORD` from the environment, with built-in defaults if unset) to get a real `role: "super-admin"` account into the database.
2. Complete [`auth.api.md`](./auth.api.md#admin-sign-in-password--mandatory-otp)'s full password + OTP sign-in flow as that account.
3. Confirm `admin_access_token` (the collection variable [`auth.api.md`](./auth.api.md#one-time-postman-setup) sets up) holds that super-admin's bearer token — every request below sends `Authorization: Bearer {{admin_access_token}}`.

**Optional collection variable:** add `admin_user_id` (leave the value empty) to paste a created admin's `_id` into, for reuse in the `PATCH .../:id` requests below.

---

## `POST /api/admin/users`

Creates a further admin account (`FR-AUTH-025`) — `catalog-manager`, `order-manager`, or `super-admin`.

| Field  | Value                          |
| ------ | -------------------------------- |
| Method | `POST`                            |
| URL    | `{{base_url}}/api/admin/users`    |
| Name   | `Create Admin User`               |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "email": "new-catalog-manager@example.com",
  "name": "New Catalog Manager",
  "role": "catalog-manager"
}
```

- `role` — one of `"catalog-manager"`, `"order-manager"`, `"super-admin"`.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e7",
    "name": "New Catalog Manager",
    "email": "new-catalog-manager@example.com",
    "role": "catalog-manager",
    "status": true,
    "createdAt": "2026-08-23T10:00:00.000Z",
    "updatedAt": "2026-08-23T10:00:00.000Z"
  }
}
```

- **No password field ever appears here or anywhere else** (`FR-AUTH-029`) — a random temporary password is generated server-side, never logged, never returned. This call immediately triggers a real password-reset email via [`auth.api.md`](./auth.api.md#post-apiauthrequest-password-reset)'s own `request-password-reset` flow, so the new admin sets their own password via the emailed link.
- The new admin still has to complete the **full** password + mandatory OTP challenge ([`auth.api.md`](./auth.api.md#admin-sign-in-password--mandatory-otp)) to actually sign in — there is no session-establishing shortcut for an API-provisioned account.
- Paste the returned `_id` into the `admin_user_id` collection variable to reuse below.

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

**A session that isn't `super-admin`** (e.g. sign in as a `catalog-manager` and retry):

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "This action requires one of: super-admin."
}
```

**Missing/invalid fields** (e.g. omitted `email`, or `role` outside the three allowed values):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "email": "Invalid email address"
  }
}
```

---

## `GET /api/admin/users`

Lists admin accounts only — this endpoint structurally can never return a buyer, regardless of query params.

| Field  | Value                          |
| ------ | -------------------------------- |
| Method | `GET`                             |
| URL    | `{{base_url}}/api/admin/users`    |
| Name   | `List Admin Users`                |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param     | Values                                                    | Default |
| --------- | ------------------------------------------------------------ | ------- |
| `page`    | integer ≥ 1                                                    | `1`     |
| `limit`   | integer 1–100                                                  | `20`    |
| `sortBy`  | `name` \| `email` \| `createdAt` \| `lastSignInAt`             | omitted |
| `orderBy` | `asc` \| `desc` \| `none`                                      | `none`  |
| `search`  | free text — matched against `name`/`email`, partial, case-insensitive | omitted |
| `role`    | `catalog-manager` \| `order-manager` \| `super-admin`          | omitted (all three) |
| `status`  | `true` \| `false`                                              | omitted (both) |

Try: `{{base_url}}/api/admin/users?role=catalog-manager&limit=10`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e7",
      "name": "New Catalog Manager",
      "email": "new-catalog-manager@example.com",
      "role": "catalog-manager",
      "status": true,
      "createdAt": "2026-08-23T10:00:00.000Z",
      "updatedAt": "2026-08-23T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

- `lastSignInAt` only appears once that admin has actually signed in at least once — omitted entirely until then (this codebase's usual "omit, never `null`" convention for an absent optional field).

### Error cases

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as create, above.

---

## `PATCH /api/admin/users/:id`

Updates another admin's `role` and/or `status` — never your own account (`FR-AUTH-026`, `028`).

| Field  | Value                                              |
| ------ | ----------------------------------------------------- |
| Method | `PATCH`                                                |
| URL    | `{{base_url}}/api/admin/users/{{admin_user_id}}`       |
| Name   | `Update Admin User`                                    |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — deactivates the account):

```json
{ "status": false }
```

Or, to change role instead: `{"role": "order-manager"}`. Both fields are optional; send only what's changing.

**Click Send. Expected response — `200 OK`:** the full updated admin record, same shape as create's response.

- **`status: false` synchronously revokes every live session for that admin, in the same request** — if you have that admin's own bearer token from a separate sign-in, retry `GET /api/auth/get-session` with it (see [`auth.api.md`](./auth.api.md#get-apiauthget-session)) and confirm it now returns `data: null`.
- Deactivating never deletes the account — there's no `DELETE` route on this module at all (see [What's Not Here Yet](#whats-not-here-yet)).

### Error cases

**`:id` equals the requesting super-admin's own id** (grab your own id from `GET /api/auth/get-session`'s `data.user.id` and try `PATCH`ing yourself):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "CANNOT_MODIFY_OWN_ACCOUNT",
  "message": "You cannot modify your own account."
}
```

Reachable regardless of which field the body touches — a role change or a status change on your own account both hit this identically.

**`:id` doesn't match any admin account** (including a well-formed id belonging to a buyer, since this module structurally excludes them):

```
404 Not Found
```

```json
{
  "success": false,
  "code": "ADMIN_USER_NOT_FOUND",
  "message": "Admin user not found."
}
```

**Malformed `:id`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_ID",
  "message": "\"not-an-id\" is not a valid id."
}
```

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as create for a missing/wrong-role session.

---

## Error Code Reference

| Code                        | Status | Where it comes from                                                                      | Reachable via an existing endpoint? |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| `UNAUTHENTICATED`            | 401    | `src/middleware/rbac.ts` — no session resolves from the request at all                        | Yes                                     |
| `FORBIDDEN`                  | 403    | `src/middleware/rbac.ts` — a real session whose role isn't `super-admin`                      | Yes                                     |
| `VALIDATION_ERROR`           | 400    | `errorHandler.ts` — a thrown `ZodError` (bad `email`/`role`/query params)                     | Yes                                     |
| `INVALID_ID`                 | 400    | `src/utils/objectId.ts`'s `parseObjectId()` — the `:id` segment isn't a valid Mongo ObjectId  | Yes                                     |
| `ADMIN_USER_NOT_FOUND`       | 404    | `adminUsers.service.ts` — `:id` doesn't match any `catalog-manager`/`order-manager`/`super-admin` account | Yes                                     |
| `CANNOT_MODIFY_OWN_ACCOUNT`  | 400    | `adminUsers.service.ts`'s `updateAdminUser` — `:id` equals the requester's own id             | Yes                                     |

---

## What's Not Here Yet

**No `DELETE` route exists by design** — `FR-AUTH-027`'s "an admin can be deactivated" doesn't extend to hard-deletion; `PATCH .../:id` with `{"status": false}` is the only removal path, matching brands'/categories'/products' own status-vs-delete distinction. "My own account" self-service (buyer profile, admin change-password) is a separate module — see [`account.api.md`](./account.api.md).
