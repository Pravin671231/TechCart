# Postman Manual — TechCart Backend API (Addresses)

A step-by-step guide to testing the buyer address book in Postman.

**Scope:** this document covers the address book module (SRS v0.5, Issue #154): a buyer's saved shipping addresses — create/list/update/delete plus a dedicated "set default" endpoint. Every route is buyer-session-only (`rbac(["buyer"])`, `src/middleware/rbac.ts`); there is **no admin surface** — nobody manages another buyer's addresses. Checkout (`POST /api/orders`, see [`orders.api.md`](./orders.api.md)) can use a saved address by id, or submit a one-off address that gets saved into this same address book as a side effect. See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Orders section for full implementation detail.

---

## Prerequisites

Same one-time collection setup as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#one-time-postman-setup) (the `base_url` variable) and [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup).

- `buyer_access_token` — from [`../authentication/auth.api.md`](../authentication/auth.api.md#buyer-sign-in)'s email-OTP (or Google One Tap) sign-in. Every request below sends `Authorization: Bearer {{buyer_access_token}}`.

**Optional collection variable:** add `address_id` (leave empty) so you can paste a created address's `_id` into it and reuse `{{address_id}}` across the requests below.

---

## `GET /api/addresses`

Lists the signed-in buyer's own saved addresses, newest first.

| Field  | Value                       |
| ------ | ---------------------------- |
| Method | `GET`                       |
| URL    | `{{base_url}}/api/addresses` |
| Name   | `List My Addresses`         |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66c1a2b3c4d5e6f7a8b9c0d1",
      "user": "66a1f0c9e4b0a1a2b3c4d5e6",
      "fullName": "Asha Rao",
      "phone": "9876543210",
      "line1": "221B, Residency Road",
      "line2": "Near City Mall",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560025",
      "isDefault": true,
      "createdAt": "2026-08-01T10:00:00.000Z",
      "updatedAt": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

- No pagination — this is a small, plain array (`data` is never wrapped in a `pagination` key here).
- An empty list is still a `200` with `data: []` for a buyer who's never added one.

### Error cases

**No session at all:**

```
401 Unauthorized
```

```json
{ "success": false, "code": "UNAUTHENTICATED", "message": "Sign in required." }
```

**An admin session:** `403 FORBIDDEN` — `"This action requires one of: buyer."` The address book is buyer-only, even for a super-admin.

---

## `POST /api/addresses`

Adds a new address to the buyer's book.

| Field  | Value                       |
| ------ | ---------------------------- |
| Method | `POST`                      |
| URL    | `{{base_url}}/api/addresses` |
| Name   | `Add Address`               |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "fullName": "Asha Rao",
  "phone": "9876543210",
  "line1": "221B, Residency Road",
  "line2": "Near City Mall",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560025"
}
```

- `fullName` — required, 1–100 chars.
- `phone` — required, 10–15 chars (no format/country-code validation beyond length).
- `line1` — required, 1–200 chars.
- `line2` — optional, 1–200 chars.
- `city` / `state` — required, 1–100 chars.
- `pincode` — required, exactly 6 digits, **first digit 1–9** (a leading `0` is rejected — `^[1-9][0-9]{5}$`).

**Click Send. Expected response — `201 Created`:** the full address record, same shape as `GET`'s items.

- `isDefault` always starts `false` on a fresh address, **regardless of what's in the request body** — there's no `isDefault` field accepted here at all. Use `PATCH .../default` below to promote it.
- Paste the returned `_id` into the `address_id` collection variable to use in the requests below.

### Error cases

**Missing a required field, or a malformed `pincode`** (e.g. `"12AB56"` or a leading-zero `"012345"`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "pincode": "Must be a valid 6-digit PIN code."
  }
}
```

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as `GET` above for a missing session or a non-buyer session.

---

## `PATCH /api/addresses/:id`

Updates any field of an existing address. All fields optional — send only what's changing; same validation constraints as `POST` when a field is present.

| Field  | Value                                       |
| ------ | -------------------------------------------- |
| Method | `PATCH`                                     |
| URL    | `{{base_url}}/api/addresses/{{address_id}}` |
| Name   | `Update Address`                            |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — updates just the city and pincode):

```json
{ "city": "Mumbai", "pincode": "400001" }
```

**Click Send. Expected response — `200 OK`:** the full updated address, same shape as `GET`'s items.

### Error cases

**Malformed `pincode`/other field:** same `VALIDATION_ERROR` shape as `POST` above.

**`:id` doesn't belong to the calling buyer** (nonexistent, or owned by someone else — both collapse to the identical response, non-enumerable):

```
404 Not Found
```

```json
{
  "success": false,
  "code": "ADDRESS_NOT_FOUND",
  "message": "Address 66c1a2b3c4d5e6f7a8b9c0d1 was not found."
}
```

**Malformed `:id` itself (not a valid ObjectId):**

```json
{ "success": false, "code": "INVALID_ID", "message": "\"not-an-id\" is not a valid id." }
```

---

## `DELETE /api/addresses/:id`

Removes an address from the book permanently.

| Field  | Value                                       |
| ------ | -------------------------------------------- |
| Method | `DELETE`                                    |
| URL    | `{{base_url}}/api/addresses/{{address_id}}` |
| Name   | `Delete Address`                            |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{ "success": true, "data": null }
```

- **Deleting the current default address does not auto-promote another address to default** — if you delete the buyer's only (default) address, the buyer simply has zero addresses and no default, until they add or promote a new one. A documented, accepted gap, not a bug.

### Error cases

Same `ADDRESS_NOT_FOUND`/`INVALID_ID` shapes as `PATCH` above for a non-owned/nonexistent/malformed `:id`.

---

## `PATCH /api/addresses/:id/default`

Sets one address as the buyer's default — used by checkout's address-resolution fallback (see [`orders.api.md`](./orders.api.md)) when neither `addressId` nor `shippingAddress` is submitted.

| Field  | Value                                               |
| ------ | ----------------------------------------------------- |
| Method | `PATCH`                                             |
| URL    | `{{base_url}}/api/addresses/{{address_id}}/default` |
| Name   | `Set Default Address`                               |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:** the now-default address, `"isDefault": true`, same shape as `GET`'s items.

- **Exactly one default address per buyer at all times** — enforced at the database level by a partial unique index on `{user, isDefault: true}`. Setting a new default first clears every other address's `isDefault` flag for that buyer, then sets the target — two writes, not one, to avoid ever momentarily violating that index.
- Confirm by re-running `GET /api/addresses` — exactly one address in the list now has `"isDefault": true`.

### Error cases

Same `ADDRESS_NOT_FOUND`/`INVALID_ID` shapes as `PATCH .../:id` above — ownership is checked **before** any existing default is cleared, so a failed attempt on someone else's id never disturbs the caller's own real default.

---

## Error Code Reference

Address-specific codes, in addition to the ones already documented in [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`) and [`../product-catalog/brands.api.md`](../product-catalog/brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                | Status | Where it comes from                                                                    | Reachable via an existing endpoint? |
| ------------------- | ------ | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| `ADDRESS_NOT_FOUND` | 404    | `addresses.service.ts` — `:id` doesn't exist, or exists but isn't owned by the caller | Yes                                     |

---

## What's Not Here Yet

There is no admin visibility into any buyer's address book at all (SRS v0.5 §7) — addresses are read only by their owner, or copied as a frozen snapshot onto an order at checkout time (see [`orders.api.md`](./orders.api.md)). There is no address-book size limit, no address labeling (e.g. "Home"/"Work"), and no address validation against a real postal database beyond the `pincode` shape check above.
