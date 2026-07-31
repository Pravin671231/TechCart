# Postman Manual — TechCart Backend API (Products)

A step-by-step guide to testing the Product core CRUD, pricing, and variant endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #31 (M2.7 — Product core CRUD and pricing, `FR-CAT-001`–`013`, `FR-CAT-085`–`087`) and Issue #32 (M2.8 — Product variants, `FR-CAT-039`–`044`): the five product-level admin endpoints under `/api/admin/products`, a dedicated stock-only path, and the two embedded-variant endpoints. It's deliberately scoped to those two issues' own checklists — there is **no** status-transition endpoint (`PATCH /api/admin/products/:id/status`, `FR-CAT-045`, `#33`), **no** admin search (`FR-CAT-050`, `#34`), and **no buyer-facing endpoint at all** yet (`GET /api/products`, `GET /api/products/:slug`, `#35`). See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup; see [`brands.api.md`](./brands.api.md) and [`categories.api.md`](./categories.api.md) for the two entities every product references; see [`categorySpecifications.api.md`](./categorySpecifications.api.md) for the schema a product's `specifications` are validated against. This doc assumes collection setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set.

**Required setup, in order** — a product can't exist without these:

1. A brand — `POST /api/admin/brands` (see [`brands.api.md`](./brands.api.md)). Paste its `_id` into a `brand_id` collection variable.
2. A category — `POST /api/admin/categories` (see [`categories.api.md`](./categories.api.md)). Paste its `_id` into a `category_id` collection variable.
3. (Optional) A specification schema for that category — `PUT /api/admin/categories/:id/specifications` (see [`categorySpecifications.api.md`](./categorySpecifications.api.md)) — only needed if you want to test `specifications` validation below.
4. At least one image object key — `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` with `"purpose": "product-image"` (see [`uploads.api.md`](./uploads.api.md)). A product create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

**Optional collection variables:** add `product_id` and `variant_id` (leave both empty) so you can paste a created product's/variant's `_id` into them and reuse `{{product_id}}`/`{{variant_id}}` across the requests below.

---

## `POST /api/admin/products`

Creates a product. The slug is auto-generated from `name`, and `sellingPrice` is always computed server-side — never accepted from you.

| Field  | Value                             |
| ------ | --------------------------------- |
| Method | `POST`                            |
| URL    | `{{base_url}}/api/admin/products` |
| Name   | `Create Product`                  |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "name": "Nova Phone X1",
  "description": "A flagship phone with a 6.1-inch display.",
  "sku": "NOVA-X1-001",
  "brand": "{{brand_id}}",
  "category": "{{category_id}}",
  "images": [
    { "objectKey": "product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp", "isPrimary": true }
  ],
  "specifications": [],
  "mrp": 99900,
  "discount": 10,
  "stock": 25,
  "lowStockThreshold": 5,
  "isFeatured": false
}
```

- `name`, `description`, `sku`, `brand`, `category`, `images`, `mrp`, `stock` — all required (`FR-CAT-001`).
- `sku` — must be unique across every product's own `sku` **and** every product's embedded variant SKUs (`FR-CAT-003`) — a shared namespace, checked at write time.
- `images` — 1 to 8 entries; each needs an `objectKey` issued by a prior presign/direct-upload call. `isPrimary` is optional — if none is marked, the first image is auto-promoted (`FR-CAT-084`).
- `specifications` — optional, defaults to `[]`. If your category has a schema defined (see prerequisite 3), every value here is validated against it — see the error case below.
- `mrp` — required, positive integer paise (`FR-CAT-085`).
- `discount` — optional integer 0–99, defaults to `0` (`FR-CAT-086`).
- `stock` — required, non-negative integer.
- `lowStockThreshold` — optional, defaults to `0`.
- `isFeatured` — optional, defaults to `false`.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "Nova Phone X1",
    "slug": "nova-phone-x1",
    "sku": "NOVA-X1-001",
    "description": "A flagship phone with a 6.1-inch display.",
    "brand": "66a1f0c9e4b0a1a2b3c4d5e1",
    "category": "66a1f0c9e4b0a1a2b3c4d5e2",
    "images": [
      {
        "url": "https://cdn.example.com/product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
        "isPrimary": true
      }
    ],
    "specifications": [],
    "variants": [],
    "mrp": 99900,
    "discount": 10,
    "sellingPrice": 89910,
    "stock": 25,
    "lowStockThreshold": 5,
    "isFeatured": false,
    "status": "draft",
    "createdBy": null,
    "updatedBy": null,
    "createdAt": "2026-07-31T10:00:00.000Z",
    "updatedAt": "2026-07-31T10:00:00.000Z"
  }
}
```

- **`sellingPrice: 89910`** — computed server-side as `mrp - floor(mrp * discount / 100)` = `99900 - floor(9990) = 89910` (`FR-CAT-087`). Try adding `"sellingPrice": 1` to your request body — it has no effect; the response still shows `89910`.
- `slug` collision handling is identical to brands/categories: a numeric suffix (`-2`, `-3`, ...) is appended if the generated slug already exists.
- `status` always starts as `"draft"` — there's no way to create a product already `published` in this issue (that's `#33`'s status-transition endpoint).
- `variants` is always `[]` on a freshly-created product — add variants afterward via `POST .../variants` below.
- `createdBy`/`updatedBy` are always `null` for now — reserved fields, unused until v0.3 authentication.
- Paste the returned `_id` into the `product_id` collection variable to use in the requests below.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint.

**Non-positive, fractional, or missing `mrp`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "mrp": "Too small: expected number to be >0"
  }
}
```

**`discount: 100`** (excluded deliberately — it would force `sellingPrice` to `0`):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "discount": "Too big: expected number to be <=99"
  }
}
```

**Negative or fractional `stock`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "stock": "Too small: expected number to be >=0"
  }
}
```

**`sku` already in use** (by another product's own `sku`, or any product's variant `sku`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "DUPLICATE_SKU",
  "message": "SKU \"NOVA-X1-001\" is already in use by another product or variant."
}
```

**`brand`/`category` don't resolve to an existing document:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "BRAND_NOT_FOUND",
  "message": "Brand 66a1f0c9e4b0a1a2b3c4d5e1 was not found."
}
```

```json
{
  "success": false,
  "code": "CATEGORY_NOT_FOUND",
  "message": "Category 66a1f0c9e4b0a1a2b3c4d5e2 was not found."
}
```

**More or fewer images than allowed (1–8):**

```json
{
  "success": false,
  "code": "IMAGE_COUNT_OUT_OF_BOUNDS",
  "message": "Expected between 1 and 8 images, got 0."
}
```

**`specifications` don't satisfy the category's schema** (requires a schema defined per prerequisite 3 — omit a `required` field, submit an unknown field name, or submit a value of the wrong type):

```json
{
  "success": false,
  "code": "SPECIFICATION_VALIDATION_FAILED",
  "message": "Specifications do not satisfy the category's schema: missing required field(s): Screen Size."
}
```

---

## `PATCH /api/admin/products/:id`

Updates any editable field. All fields optional — send only what's changing. **`sku` is not editable** — it's set once at create and never accepted here (`FR-CAT-004`'s field list omits it, same as brands'/categories' `slug`).

| Field  | Value                                            |
| ------ | ------------------------------------------------ |
| Method | `PATCH`                                          |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}` |
| Name   | `Update Product`                                 |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — updates only the price):

```json
{
  "mrp": 89900,
  "discount": 15
}
```

**Click Send. Expected response — `200 OK`:** the full updated product, same shape as create's response — `sellingPrice` recomputed to `76415` (`89900 - floor(13485)`).

- Submitting only `mrp` (or only `discount`) still recomputes `sellingPrice` correctly — the other value is read from what's already stored.
- Submitting a `sku` in this body is silently ignored, not rejected — it simply isn't a recognized field here.
- **Moving `category`** re-validates the product's specifications against the _new_ category's schema (`FR-CAT-034`) — even if you don't also submit new `specifications` in the same request, the existing stored values must satisfy the new schema, or the update is rejected naming the offending fields (same `SPECIFICATION_VALIDATION_FAILED` shape as create).
- **Sending new `images`** replaces the entire array — there's no way to add or remove a single image without resending the full set.

### Error cases

Same `INVALID_ID`/`PRODUCT_NOT_FOUND`, `VALIDATION_ERROR`, `DUPLICATE_SKU` (n/a here — sku isn't accepted), `BRAND_NOT_FOUND`/`CATEGORY_NOT_FOUND`, `IMAGE_COUNT_OUT_OF_BOUNDS`, and `SPECIFICATION_VALIDATION_FAILED` cases as `POST` above.

---

## `GET /api/admin/products/:id`

Fetches a single product by id, at **any** status (`draft`, `published`, or `archived`) — a read-only detail view, distinct from the create/edit form (`FR-CAT-006`).

| Field  | Value                                            |
| ------ | ------------------------------------------------ |
| Method | `GET`                                            |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}` |
| Name   | `Get Product (Admin)`                            |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Click Send. Expected response — `200 OK`:** same shape as create's response, full field set.

### Error cases

**Malformed id:**

```json
{
  "success": false,
  "code": "INVALID_ID",
  "message": "\"not-an-id\" is not a valid id."
}
```

**Well-formed id that doesn't match any product:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "PRODUCT_NOT_FOUND",
  "message": "Product 66a1f0c9e4b0a1a2b3c4d5e6 was not found."
}
```

---

## `GET /api/admin/products`

Lists products at **any** status, paginated and sortable (`FR-CAT-005`) — the first paginated admin list in this API.

| Field  | Value                             |
| ------ | --------------------------------- |
| Method | `GET`                             |
| URL    | `{{base_url}}/api/admin/products` |
| Name   | `List Products (Admin)`           |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Query params (all optional):**

| Param      | Values                                                                                     | Default      |
| ---------- | ------------------------------------------------------------------------------------------ | ------------ |
| `page`     | integer ≥ 1                                                                                | `1`          |
| `limit`    | integer 1–100                                                                              | `20`         |
| `sort`     | `createdAt` \| `-createdAt` \| `name` \| `-name` \| `mrp` \| `-mrp` \| `stock` \| `-stock` | `-createdAt` |
| `lowStock` | `true` (presence-based — any other value is rejected)                                      | omitted      |

Try: `{{base_url}}/api/admin/products?page=1&limit=10&sort=-mrp`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Nova Phone X1",
      "sellingPrice": 89910,
      "...": "..."
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

- **`-` prefix means descending** — `sort=-mrp` orders highest price first; `sort=mrp` orders lowest first.
- **`lowStock=true`** filters to products whose `stock` is at or below their own `lowStockThreshold` (`FR-CAT-011`) — each product's own threshold, not a fixed number.
- No `search` query param — that's `FR-CAT-050`'s admin-search scope (`#34`), same deferral brands/categories already made.
- An oversized `limit` (e.g. `?limit=1000`) is **rejected**, not silently clamped:

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "limit": "Too big: expected number to be <=100"
  }
}
```

**An unrecognized `sort` value:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "sort": "Invalid option: expected one of \"createdAt\"|\"-createdAt\"|\"name\"|\"-name\"|\"mrp\"|\"-mrp\"|\"stock\"|\"-stock\""
  }
}
```

---

## `DELETE /api/admin/products/:id`

Soft-deletes a product — flips `status` to `"archived"`; the document is **never** hard-removed, since Orders (v0.5) will hold references to it (`FR-CAT-007`).

| Field  | Value                                            |
| ------ | ------------------------------------------------ |
| Method | `DELETE`                                         |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}` |
| Name   | `Delete Product`                                 |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": null
}
```

Confirm by re-running `GET /api/admin/products/:id` — the product is still there, now with `"status": "archived"`.

- **Unlike brands'/categories' guarded deletes**, a nonexistent id here returns `404 PRODUCT_NOT_FOUND`, not a silent `200`/`data: null` — there's no in-use guard with a "naturally zero" fallback to lean on; this is a plain status flip.

### Error cases

**Malformed id:** same `INVALID_ID` shape as above.

**Nonexistent id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

---

## `PATCH /api/admin/products/:id/stock`

Adjusts a product's stock quantity in isolation, without submitting (or risking touching) any other field (`FR-CAT-008`).

| Field  | Value                                                  |
| ------ | ------------------------------------------------------ |
| Method | `PATCH`                                                |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}/stock` |
| Name   | `Update Product Stock`                                 |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "stock": 40 }
```

**Click Send. Expected response — `200 OK`:** the full updated product, `stock: 40`, every other field unchanged.

### Error cases

**Negative or fractional `stock`** (`FR-CAT-009`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "stock": "Too small: expected number to be >=0"
  }
}
```

**Nonexistent id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

---

## `POST /api/admin/products/:id/variants`

Adds a sellable variant to a product — its own SKU, attribute combination, price, and stock, independent of the parent product's own.

| Field  | Value                                                     |
| ------ | --------------------------------------------------------- |
| Method | `POST`                                                    |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}/variants` |
| Name   | `Add Product Variant`                                     |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "sku": "NOVA-X1-001-BLK-128",
  "attributes": [
    { "name": "Color", "value": "Black" },
    { "name": "Storage", "value": "128GB" }
  ],
  "mrp": 104900,
  "discount": 10,
  "stock": 15,
  "weight": 0.19
}
```

- `sku` — required, in the **same shared namespace** as every product's own `sku` (`FR-CAT-003`) — rejected if it collides with any product's `sku` or any variant's `sku` anywhere, including this same product. Unlike the parent product's own `sku`, a variant's `sku` **can** be changed later via `PATCH` (see below).
- `attributes` — required, 1+ `{name, value}` pairs. No two variants of this product (active or inactive) may share an identical set — order doesn't matter (`Color=Black, Storage=128GB` collides with `Storage=128GB, Color=Black`).
- `images` — optional, omit entirely or send `0` items for "no images of its own" (falls back to the parent's images once buyer endpoints exist, `#35`); if you do send images, it must be **1 or 2**, each an `objectKey` from a prior presign/direct-upload call, same rules as the parent's own `images`.
- `mrp`/`discount`/`stock` — identical validation to the parent product's own fields (`FR-CAT-042`).
- `weight` — optional, a positive number.
- `active` is not accepted here — every new variant starts `active: true`; deactivate it afterward via `PATCH`.

**Click Send. Expected response — `201 Created`:** the full updated product (same shape as `GET :id`), with the new variant appended to `variants`:

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "...": "... every other product field ...",
    "variants": [
      {
        "_id": "66a1f0c9e4b0a1a2b3c4d5e9",
        "sku": "NOVA-X1-001-BLK-128",
        "attributes": [
          { "name": "Color", "value": "Black" },
          { "name": "Storage", "value": "128GB" }
        ],
        "images": [],
        "mrp": 104900,
        "discount": 10,
        "sellingPrice": 94410,
        "stock": 15,
        "weight": 0.19,
        "active": true,
        "createdAt": "2026-08-03T10:00:00.000Z",
        "updatedAt": "2026-08-03T10:00:00.000Z"
      }
    ]
  }
}
```

- **`sellingPrice: 94410`** — computed server-side identically to a product (`104900 - floor(10490) = 94410`), never accepted from you.
- Paste the new variant's `_id` into the `variant_id` collection variable to use in the `PATCH` request below.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`.

**Nonexistent product id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

**Empty `attributes` array:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "attributes": "Too small: expected array to have >=1 items"
  }
}
```

**`sku` colliding with the parent product's own `sku`, a sibling variant's `sku`, or any other product's `sku`/variant `sku`:**

```json
{
  "success": false,
  "code": "DUPLICATE_SKU",
  "message": "SKU \"NOVA-X1-001-BLK-128\" is already in use by another product or variant."
}
```

**Attribute combination duplicating an existing variant's** (add the same variant twice, or the same pairs in a different order):

```json
{
  "success": false,
  "code": "DUPLICATE_VARIANT_ATTRIBUTES",
  "message": "A variant with this exact attribute combination already exists on this product."
}
```

**Non-positive `mrp`, `discount: 100`, negative/fractional `stock`, or non-positive `weight`:** same `VALIDATION_ERROR` shapes as `POST /api/admin/products` above.

**More than 2 images, or exactly 0 explicitly-rejected count** (only reachable by sending 3+, since 0 is valid):

```json
{
  "success": false,
  "code": "IMAGE_COUNT_OUT_OF_BOUNDS",
  "message": "Expected between 1 and 2 images, got 3."
}
```

---

## `PATCH /api/admin/products/:id/variants/:variantId`

Updates any variant field, or deactivates it by setting `active: false` — a soft delete. All fields optional — send only what's changing.

| Field  | Value                                                                    |
| ------ | ------------------------------------------------------------------------ |
| Method | `PATCH`                                                                  |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}/variants/{{variant_id}}` |
| Name   | `Update Product Variant`                                                 |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — deactivates the variant):

```json
{ "active": false }
```

**Click Send. Expected response — `200 OK`:** the full updated product — the variant is still present in `variants`, now with `"active": false`. It is **never removed** from the array, regardless of `active`'s value (`FR-CAT-040`).

- Updating `mrp` and/or `discount` recomputes `sellingPrice` the same way the product-level `PATCH` does — submitting only one still recomputes correctly, using the variant's own currently-stored value for the other.
- `sku` **can** be changed here (unlike the parent product's own `sku`) — re-validated against every other product/variant plus this product's own `sku` and sibling variants, identically to create.
- Changing `attributes` re-checks the duplicate-combination guard against every _other_ variant on this product.
- Sending new `images` replaces the variant's entire image array (same `0` or `1`–`2` bound as create).

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`.

**Nonexistent product id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

**`variantId` doesn't match any variant on this product:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "VARIANT_NOT_FOUND",
  "message": "Variant 66a1f0c9e4b0a1a2b3c4d5e9 was not found."
}
```

**Recoding `sku` to collide with the parent product's own `sku`, a sibling variant's `sku`, or any other product's:** same `DUPLICATE_SKU` shape as `POST .../variants` above.

**Changing `attributes` to duplicate a sibling variant's combination:** same `DUPLICATE_VARIANT_ATTRIBUTES` shape as `POST .../variants` above.

**Non-positive `mrp`, `discount: 100`, negative/fractional `stock`, or non-positive `weight`:** same `VALIDATION_ERROR` shapes as `POST /api/admin/products` above.

---

## Error Code Reference

Product-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `OBJECT_KEY_NOT_ISSUED`, `IMAGE_COUNT_OUT_OF_BOUNDS`), [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`, `BRAND_NOT_FOUND`), [`categories.api.md`](./categories.api.md#error-code-reference) (`CATEGORY_NOT_FOUND`), and [`categorySpecifications.api.md`](./categorySpecifications.api.md#error-code-reference):

| Code                              | Status | Where it comes from                                                                                                                                  | Reachable via an existing endpoint?                 |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `PRODUCT_NOT_FOUND`               | 404    | `products.service.ts` — `:id` doesn't match any product                                                                                              | Yes                                                 |
| `VARIANT_NOT_FOUND`               | 404    | `products.service.ts`'s `updateVariant()` — `:variantId` doesn't match any variant on that product                                                   | Yes                                                 |
| `DUPLICATE_SKU`                   | 400    | `products.service.ts` — `sku` collides with another product's own `sku`, or any variant's `sku` anywhere (including a sibling on the same product)   | Yes                                                 |
| `DUPLICATE_VARIANT_ATTRIBUTES`    | 400    | `products.service.ts`'s `addVariant()`/`updateVariant()` — the attribute-pair set duplicates another variant's on the same product                   | Yes                                                 |
| `SPECIFICATION_VALIDATION_FAILED` | 400    | `categorySpecifications.service.ts`'s `validateProductSpecifications()`, called from `products.service.ts` on create and on category-changing update | Yes — requires a specification schema defined first |

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For products, the fields that can appear as keys include `name`, `description`, `sku`, `brand`, `category`, `images`, `specifications`, `mrp`, `discount`, `stock`, `lowStockThreshold`, `isFeatured`, `metaTitle`, `metaDescription`, and — on the list endpoint — `page`, `limit`, `sort`, `lowStock`. For the two variant endpoints: `sku`, `attributes`, `images`, `mrp`, `discount`, `stock`, `weight`.

---

## What's Not Here Yet

This document is a snapshot of Issues #31 and #32 — not the full Product Catalog API. Not yet implemented, each its own future issue:

- Status transition endpoint, `PATCH /api/admin/products/:id/status` (`FR-CAT-045`, `#33`)
- Admin search, including `search` on `GET /api/admin/products` (`FR-CAT-050`, `#34`)
- Buyer browsing/search/inventory visibility, including `GET /api/products` and `GET /api/products/:slug` (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
