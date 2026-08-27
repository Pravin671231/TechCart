# Postman Manual — TechCart Backend API (Brands)

A step-by-step guide to testing the Brand management endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #27 (M2.3 — Brand management, `FR-CAT-023`–`029`), Issue #33 (M2.9 — Status update APIs, `FR-CAT-047`–`048` for this entity), and Issue #34 (M2.10 — Admin search, `FR-CAT-052` for this entity): the five admin CRUD endpoints under `/api/admin/brands`, the status-toggle endpoint, `search` on the admin list, and the public `GET /api/brands`. See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup (`base_url` variable); the admin routes here send `Authorization: Bearer {{admin_access_token}}` from [`../authentication/auth.api.md`](../authentication/auth.api.md)'s admin sign-in. This doc assumes that setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, and an `admin_access_token` collection variable set from [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup)'s admin sign-in (password + OTP, as a `catalog-manager` or `super-admin`). A brand's `logo` field is optional and, if you want to test it, requires first getting an `objectKey` from `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` (see that doc) — a brand create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

**Optional collection variable:** add `brand_id` (leave the value empty) so you can paste a created brand's `_id` into it and reuse `{{brand_id}}` across the `GET/PATCH/DELETE :id` requests below.

---

## `POST /api/admin/brands`

Creates a brand. The slug is auto-generated from `name` server-side — you cannot set it directly.

| Field  | Value                                |
| ------ | ------------------------------------- |
| Method | `POST`                                |
| URL    | `{{base_url}}/api/admin/brands`       |
| Name   | `Create Brand`                        |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "name": "Nova Electronics",
  "description": "Consumer electronics and gadgets.",
  "logo": {
    "objectKey": "brand-logo/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
    "alt": "Nova Electronics logo"
  }
}
```

- `name` — required, non-empty.
- `description` — optional.
- `logo` — optional. `objectKey` must be a key issued by a prior presign/direct-upload call and not already consumed; `alt` is optional. Omit `logo` entirely to create a brand with no logo.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "Nova Electronics",
    "slug": "nova-electronics",
    "description": "Consumer electronics and gadgets.",
    "logo": {
      "url": "https://cdn.example.com/brand-logo/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
      "alt": "Nova Electronics logo"
    },
    "status": true,
    "createdBy": null,
    "updatedBy": null,
    "createdAt": "2026-07-29T10:00:00.000Z",
    "updatedAt": "2026-07-29T10:00:00.000Z"
  }
}
```

- `slug` is lowercase/hyphenated from `name`, with a numeric suffix (`-2`, `-3`, ...) appended if it collides with an existing brand's slug (`FR-CAT-024`) — create the same `name` twice to see this.
- `logo.url` is built from the consumed `objectKey`, not something you provide directly — note there's no `isPrimary` key on a brand logo (unlike a product's image array, a single logo has nothing to be "primary" among).
- `createdBy`/`updatedBy` are always `null` for now — reserved fields, unused until v0.3 authentication lands.
- Paste the returned `_id` into the `brand_id` collection variable to use in the requests below.

### Error cases

**Missing or invalid bearer token:** `401 UNAUTHENTICATED` (or `403 FORBIDDEN` for a valid session whose role isn't `catalog-manager`/`super-admin`) — same shape as every other admin endpoint (see [Error Code Reference](#error-code-reference)).

**Missing `name`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "name": "Invalid input: expected string, received undefined"
  }
}
```

**`logo.objectKey` was never issued, or was already consumed:**

```json
{
  "success": false,
  "code": "OBJECT_KEY_NOT_ISSUED",
  "message": "Object key \"brand-logo/not-a-real-key.webp\" was not issued by this server, or has already been consumed."
}
```

---

## `GET /api/admin/brands`

Lists every brand, any status, each with its product count — paginated and sortable (`FR-CAT-026`, Issue #104).

| Field  | Value                          |
| ------ | ------------------------------- |
| Method | `GET`                           |
| URL    | `{{base_url}}/api/admin/brands` |
| Name   | `List Brands (Admin)`           |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param     | Values                                                           | Default |
| --------- | ----------------------------------------------------------------- | ------- |
| `page`    | integer ≥ 1                                                        | `1`     |
| `limit`   | integer 1–100                                                      | `20`    |
| `sortBy`  | `name` \| `createdAt`                                              | omitted |
| `orderBy` | `asc` \| `desc` \| `none`                                          | `none`  |
| `search`  | free text — matched against `name`, partial and case-insensitive  | omitted |

Try: `{{base_url}}/api/admin/brands?search=nova` — matches "Nova Electronics" regardless of case or position within the name (`FR-CAT-052`).

Try pagination + sort: `{{base_url}}/api/admin/brands?page=1&limit=10&sortBy=name&orderBy=asc`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Nova Electronics",
      "slug": "nova-electronics",
      "status": true,
      "createdBy": null,
      "updatedBy": null,
      "createdAt": "2026-07-29T10:00:00.000Z",
      "updatedAt": "2026-07-29T10:00:00.000Z",
      "productCount": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

- `productCount` reflects products of **any** status (`draft`, `published`, `archived`) referencing the brand — not just published ones. Create a product against this brand via [`products.api.md`](./products.api.md) (`#31`) to see this go above `0`.
- `search` spans **all** statuses, same as the unfiltered list — it doesn't hide inactive brands.
- `search` is a plain MongoDB regex query, not Atlas Search — same mechanism as `search` on [`GET /api/admin/products`](./products.api.md#get-apiadminproducts) and [`GET /api/admin/categories`](./categories.api.md#get-apiadmincategories) (`FR-CAT-050`–`052`).
- **Amended, Issue #104: paginated and sortable, same shape as [`GET /api/admin/products`](./products.api.md#get-apiadminproducts)** — previously this endpoint returned every brand unpaginated in one response. `orderBy` defaults to `none` (no `sortBy` default either) so a request with no sort params still returns the same unordered result this endpoint always has.

---

## `GET /api/admin/brands/:id`

Fetches a single brand by id, any status.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `GET`                                      |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}` |
| Name   | `Get Brand (Admin)`                        |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`.

**Click Send. Expected response — `200 OK`:** same shape as a single item from the list above, minus `productCount` (this endpoint doesn't compute it).

### Error cases

**Malformed id** (e.g. `{{base_url}}/api/admin/brands/not-an-id`):

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

**Well-formed id that doesn't match any brand:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "BRAND_NOT_FOUND",
  "message": "Brand 66a1f0c9e4b0a1a2b3c4d5e6 was not found."
}
```

---

## `PATCH /api/admin/brands/:id`

Updates `name`, `description`, and/or `logo`. All fields optional — send only what's changing.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `PATCH`                                    |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}` |
| Name   | `Update Brand`                             |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — updates only the description):

```json
{
  "description": "Consumer electronics, gadgets, and smart home devices."
}
```

**Click Send. Expected response — `200 OK`:** the full updated brand, same shape as create's response.

- **The slug never changes**, even if you also send a new `name` — it's assigned once at creation and treated as a stable identifier so existing URLs don't break (`FR-CAT-025` only lists `name`/`logo`/`description` as updatable, not `slug`).
- Sending a new `logo.objectKey` consumes it and replaces the stored logo, exactly like create — the old logo's object in R2 is not deleted (no cleanup logic exists for that yet).
- Omitted fields are left untouched — this endpoint never overwrites `description` (or `logo`) with an empty value just because you didn't mention it.

### Error cases

Same `INVALID_ID` (malformed id) and `BRAND_NOT_FOUND` (no such brand) as the `GET :id` endpoint above, plus the same `VALIDATION_ERROR`/`OBJECT_KEY_NOT_ISSUED` cases as create.

---

## `PATCH /api/admin/brands/:id/status`

Toggles the brand's boolean `status` (`FR-CAT-047`) — active/inactive, not a soft delete. A dedicated endpoint rather than folded into the general `PATCH` above, matching categories'/products' own status endpoints.

| Field  | Value                                           |
| ------ | -------------------------------------------------- |
| Method | `PATCH`                                             |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}/status` |
| Name   | `Update Brand Status`                               |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "status": false }
```

**Click Send. Expected response — `200 OK`:** the full updated brand, `status: false`, every other field unchanged.

- **Deactivating never checks or bypasses the `DELETE` guard above** (`FR-CAT-048`) — a brand referenced by products can always be deactivated; only an actual `DELETE` is blocked while products reference it.
- **Immediately hides the brand from `GET /api/brands`** below (`FR-CAT-048`) — that endpoint already filters `status: true`, so no separate propagation step is needed. `GET /api/admin/brands/:id` still returns it regardless of `status`.
- Re-run with `{"status": true}` to reactivate.

### Error cases

**Missing or invalid bearer token:** `401 UNAUTHENTICATED`.

**Nonexistent id:** same `BRAND_NOT_FOUND` shape as `GET :id` above.

**Non-boolean `status`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "status": "Invalid input: expected boolean, received string"
  }
}
```

---

## `DELETE /api/admin/brands/:id`

Deletes a brand — but only if **zero** products of any status reference it (`FR-CAT-028`). Create a product against this brand via [`products.api.md`](./products.api.md) (`#31`) first to exercise the guard below; otherwise the delete succeeds unconditionally.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `DELETE`                                   |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}` |
| Name   | `Delete Brand`                             |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": null
}
```

- **Note:** deleting an id that doesn't match any brand also returns this same `200`/`data: null` response, not a `404` — the guard only checks "how many products reference this id" (zero, for a nonexistent brand), then issues a delete that silently matches nothing. This is current, observed behavior, not a documentation error.

### Error cases

**Malformed id:** same `INVALID_ID` shape as above.

**Brand is referenced by at least one product (any status — draft, published, or archived):**

```
409 Conflict
```

```json
{
  "success": false,
  "code": "BRAND_IN_USE",
  "message": "Cannot delete brand: referenced by 2 product(s)."
}
```

Reproducible now — create a product against the brand via [`products.api.md`](./products.api.md), then retry this delete.

---

## `GET /api/brands`

Public, buyer-facing brand list — active brands only, public fields only. No auth header needed.

| Field  | Value                     |
| ------ | -------------------------- |
| Method | `GET`                      |
| URL    | `{{base_url}}/api/brands`  |
| Name   | `List Brands (Public)`     |

No headers, no body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Nova Electronics",
      "slug": "nova-electronics",
      "description": "Consumer electronics, gadgets, and smart home devices.",
      "logo": {
        "url": "https://cdn.example.com/brand-logo/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
        "alt": "Nova Electronics logo"
      }
    }
  ]
}
```

- Only brands with `status: true` are returned — deactivate one via `PATCH /api/admin/brands/:id/status` above to see it drop out of this list.
- `status`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` are stripped entirely — this response only ever has `_id`, `name`, `slug`, and (when present) `logo`/`description`.
- No auth header required — this is a public buyer endpoint; sending an admin `Authorization` header here has no effect either way.

---

## Error Code Reference

Brand-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, and — now reachable for the first time via brand create/update — `OBJECT_KEY_NOT_ISSUED`):

| Code              | Status | Where it comes from                                                             | Reachable via an existing endpoint? |
| ----------------- | ------ | --------------------------------------------------------------------------------- | ------------------------------------ |
| `INVALID_ID`       | 400    | `brands.controller.ts`'s `parseObjectId()` — the `:id` segment isn't a valid Mongo ObjectId | Yes                                  |
| `BRAND_NOT_FOUND`  | 404    | `brands.service.ts` — `GET`/`PATCH`/`PATCH .../status` by an id with no matching brand | Yes                                  |
| `BRAND_IN_USE`     | 409    | `brands.service.ts`'s `deleteBrand()` — the brand is referenced by ≥1 product, any status | Yes — see [`products.api.md`](./products.api.md) (#31) |

---

## Understanding Validation Errors

Same `errors`-object shape as `uploads.api.md` — see [that section](./uploads.api.md#understanding-validation-errors) for the general explanation. For brands, the fields that can appear as keys are `name`, `description`, `logo.objectKey`, `logo.alt`, and — on the list endpoint — `page`, `limit`, `sortBy`, `orderBy`, `search`.

---

## What's Not Here Yet

This document is a snapshot of Issue #27 (plus #33's status endpoint and #34's `search` param, folded into this same doc) — not the full Product Catalog API. Category management (`#28`), category-governed specifications (`#29`), category-governed variant types (`#30`), and product core CRUD plus product variants (`#31`, `#32`) are now covered in [`categories.api.md`](./categories.api.md), [`categorySpecifications.api.md`](./categorySpecifications.api.md), [`categoryVariants.api.md`](./categoryVariants.api.md), and [`products.api.md`](./products.api.md) respectively. Not yet implemented, each its own future issue:

- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

Admin authentication is real session + RBAC — send `Authorization: Bearer <token>` from an admin sign-in (`src/middleware/rbac.ts`), see [`../authentication/auth.api.md`](../authentication/auth.api.md). The former `X-Admin-Key` placeholder was removed by Issue #143/M3.5.
