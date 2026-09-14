# Postman Manual — TechCart Backend API (User Directory)

A step-by-step guide to testing the admin user directory in Postman.

**Scope:** this document covers the user directory (`FR-AUTH-047`–`049`): a super-admin can view a paginated, searchable, filterable, **read-only** listing of every account in the system — buyers and admins alike. Distinct from [`adminUsers.api.md`](./adminUsers.api.md), which structurally only ever lists the three admin roles. Every route below requires a real session for a `role: "super-admin"` account (`rbac(["super-admin"])`, `src/middleware/rbac.ts`). See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md) (Issue #385 section) for full implementation detail.

---

## Prerequisites

Same as [`adminUsers.api.md`](./adminUsers.api.md#prerequisites) — a real super-admin session, with `admin_access_token` already set from [`auth.api.md`](./auth.api.md#one-time-postman-setup).

---

## `GET /api/admin/user-directory`

Lists every account — buyer, catalog-manager, order-manager, super-admin — with no role restriction.

| Field  | Value                                    |
| ------ | ------------------------------------------- |
| Method | `GET`                                        |
| URL    | `{{base_url}}/api/admin/user-directory`      |
| Name   | `List User Directory`                        |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param     | Values                                                              | Default |
| --------- | ------------------------------------------------------------------ | ------- |
| `page`    | integer ≥ 1                                                          | `1`     |
| `limit`   | integer 1–100                                                        | `20`    |
| `sortBy`  | `name` \| `email` \| `createdAt` \| `lastSignInAt`                    | omitted |
| `orderBy` | `asc` \| `desc` \| `none`                                            | `none`  |
| `search`  | free text — matched against `name`/`email`, partial, case-insensitive | omitted |
| `role`    | `buyer` \| `catalog-manager` \| `order-manager` \| `super-admin`      | omitted (all four) |
| `status`  | `true` \| `false`                                                    | omitted (both) |

Try: `{{base_url}}/api/admin/user-directory?role=buyer&limit=10`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e7",
      "name": "Asha Rao",
      "email": "asha@example.com",
      "role": "buyer",
      "status": true,
      "isVerified": true,
      "createdAt": "2026-08-23T10:00:00.000Z"
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

- **`passwordHash` never appears here** — this endpoint queries the `User` model only (see `backend/CLAUDE.md`), which doesn't store credentials at all; `userAuth` (the credentials collection) is never touched by this route.
- `lastSignInAt` only appears once that account has actually signed in at least once — omitted until then, same convention as `adminUsers.api.md`.
- **Read-only**: no `POST`/`PATCH`/`DELETE` exists on this route. Modifying an admin account still goes through [`adminUsers.api.md`](./adminUsers.api.md); no equivalent modification path exists for buyer accounts in this version.

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

---

## Error Code Reference

| Code              | Status | Where it comes from                                                     | Reachable via an existing endpoint? |
| ------------------ | ------ | ------------------------------------------------------------------------- | -------------------------------------- |
| `UNAUTHENTICATED` | 401    | `src/middleware/rbac.ts` — no session resolves from the request at all    | Yes                                     |
| `FORBIDDEN`        | 403    | `src/middleware/rbac.ts` — a real session whose role isn't `super-admin`  | Yes                                     |
| `VALIDATION_ERROR` | 400    | `errorHandler.ts` — a thrown `ZodError` (bad query params)                | Yes                                     |

---

## What's Not Here Yet

No create/update/delete on this route by design (`FR-AUTH-049`) — it's a read-only visibility surface, not a management API. Admin account management stays exclusively [`adminUsers.api.md`](./adminUsers.api.md); buyer profile self-service is [`account.api.md`](./account.api.md#get-apiaccountprofile) (buyer-only, self-scoped — there is no admin-facing "edit any buyer" endpoint).
