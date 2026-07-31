# Postman Manual — TechCart Backend API (Brands)

A step-by-step guide to testing the Brand management endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #27 (M2.3 — Brand management, `FR-CAT-023`–`029`): the five admin endpoints under `/api/admin/brands` and the public `GET /api/brands`. It's deliberately scoped to issue #27's own checklist — there is **no** status-toggle endpoint (`PATCH /api/admin/brands/:id/status`, `FR-CAT-047`) and **no** search on the admin list (`FR-CAT-052`) yet; both are separate, later issues (#33, #34) that wait until brands, categories, and products all exist. See [`uploads.api.md`](./uploads.api.md) for `GET /health` and the R2 upload endpoints, and for the one-time Postman collection setup (`base_url`, `admin_api_key` variables) — this doc assumes that setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set. A brand's `logo` field is optional and, if you want to test it, requires first getting an `objectKey` from `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` (see that doc) — a brand create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

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
X-Admin-Key: {{admin_api_key}}
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

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint (see [Error Code Reference](#error-code-reference)).

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

Lists every brand, any status, each with its product count.

| Field  | Value                          |
| ------ | ------------------------------- |
| Method | `GET`                           |
| URL    | `{{base_url}}/api/admin/brands` |
| Name   | `List Brands (Admin)`           |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

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
  ]
}
```

- `productCount` reflects products of **any** status (`draft`, `published`, `archived`) referencing the brand — not just published ones. Create a product against this brand via [`products.api.md`](./products.api.md) (`#31`) to see this go above `0`.
- No `search` query param — admin search lands in #34.
- No `pagination` key — every brand is returned in one response at this scale.

---

## `GET /api/admin/brands/:id`

Fetches a single brand by id, any status.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `GET`                                      |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}` |
| Name   | `Get Brand (Admin)`                        |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`.

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
X-Admin-Key: {{admin_api_key}}
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

## `DELETE /api/admin/brands/:id`

Deletes a brand — but only if **zero** products of any status reference it (`FR-CAT-028`). Create a product against this brand via [`products.api.md`](./products.api.md) (`#31`) first to exercise the guard below; otherwise the delete succeeds unconditionally.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `DELETE`                                   |
| URL    | `{{base_url}}/api/admin/brands/{{brand_id}}` |
| Name   | `Delete Brand`                             |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

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

Public, buyer-facing brand list — active brands only, public fields only. No `X-Admin-Key` needed.

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

- Only brands with `status: true` are returned — there's no status-toggle endpoint yet (#33), so every brand you create stays active until one exists.
- `status`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` are stripped entirely — this response only ever has `_id`, `name`, `slug`, and (when present) `logo`/`description`.
- No auth header required — sending an `X-Admin-Key` here has no effect either way.

---

## Error Code Reference

Brand-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, and — now reachable for the first time via brand create/update — `OBJECT_KEY_NOT_ISSUED`):

| Code              | Status | Where it comes from                                                             | Reachable via an existing endpoint? |
| ----------------- | ------ | --------------------------------------------------------------------------------- | ------------------------------------ |
| `INVALID_ID`       | 400    | `brands.controller.ts`'s `parseObjectId()` — the `:id` segment isn't a valid Mongo ObjectId | Yes                                  |
| `BRAND_NOT_FOUND`  | 404    | `brands.service.ts` — `GET`/`PATCH` by an id with no matching brand               | Yes                                  |
| `BRAND_IN_USE`     | 409    | `brands.service.ts`'s `deleteBrand()` — the brand is referenced by ≥1 product, any status | Yes — see [`products.api.md`](./products.api.md) (#31) |

---

## Understanding Validation Errors

Same `errors`-object shape as `uploads.api.md` — see [that section](./uploads.api.md#understanding-validation-errors) for the general explanation. For brands, the fields that can appear as keys are `name`, `description`, `logo.objectKey`, and `logo.alt`.

---

## What's Not Here Yet

This document is a snapshot of Issue #27 — not the full Product Catalog API. Category management (`#28`), category-governed specifications (`#29`), category-governed variant types (`#30`), and product core CRUD plus product variants (`#31`, `#32`) are now covered in [`categories.api.md`](./categories.api.md), [`categorySpecifications.api.md`](./categorySpecifications.api.md), [`categoryVariants.api.md`](./categoryVariants.api.md), and [`products.api.md`](./products.api.md) respectively. Not yet implemented, each its own future issue:

- Status update APIs, including `PATCH /api/admin/brands/:id/status` (`#33`)
- Admin search, including `search` on `GET /api/admin/brands` (`#34`)
- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
