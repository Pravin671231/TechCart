# Postman Manual — TechCart Backend API (Products)

A step-by-step guide to testing the Product core CRUD, pricing, and variant endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #31 (M2.7 — Product core CRUD and pricing, `FR-CAT-001`–`013`, `FR-CAT-085`–`087`), Issue #32 (M2.8 — Product variants, `FR-CAT-039`–`044`), Issue #33 (M2.9 — Status update APIs, `FR-CAT-045`, `048`–`049` for this entity), Issue #34 (M2.10 — Admin search, `FR-CAT-050`, `053` for this entity), Issue #35 (M2.11 — Buyer browsing, search & inventory visibility, `FR-CAT-054`–`067`, `095`–`096`), Issue #36 (M2.12 — Buyer filtering, sorting & card content, `FR-CAT-068`–`076`, `091`–`092`), and Issue #102 (SRS v0.2 amendment — variant-only pricing, stock/inventory tracking removed system-wide): the four product-level admin CRUD endpoints under `/api/admin/products` (create/update/get/list — there is no product-level stock-update path anymore), the status-transition path, the two embedded-variant endpoints, `search`/`status` filtering on the admin list, and the two buyer-facing endpoints — `GET /api/products` (paginated, `published`-only, filterable, sortable, optional Atlas Search `?q=`) and `GET /api/products/:slug` (detail). `GET /api/products?q=` and its variant-attribute/specification filters all depend on a MongoDB Atlas Search index this repo cannot provision for you — see [`../../backend/atlas-search/README.md`](../../backend/atlas-search/README.md) before testing those specifically; every other query on this endpoint (category/brand/price/on-sale/sort) needs no Atlas cluster at all. See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup; see [`brands.api.md`](./brands.api.md) and [`categories.api.md`](./categories.api.md) for the two entities every product references (including categories.api.md's own `GET /api/categories/:slug/products`, which lists *this* module's data and shares this endpoint's filter/sort surface); see [`categorySpecifications.api.md`](./categorySpecifications.api.md) for the schema a product's `specifications` — and the `filterable` flag driving both the specification filter and `cardSpecifications` below — are validated against. This doc assumes collection setup is already done and reuses the same collection.

**Issue #102 in one paragraph:** a product itself now carries no `sku`, `images`, `mrp`, `discount`, `sellingPrice`, or stock of any kind — it is pure metadata (name/description/brand/category/specifications/SEO/`isFeatured`). Every sellable, priced, imaged unit is a variant, and a product needs at least one **active** variant before it can be published. Stock/inventory tracking (and the derived buyer-facing `availability` field) is removed from this system entirely, not moved to the variant — every catalog entry is treated as always orderable from a catalog standpoint.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set.

**Required setup, in order** — a product can't exist without these:

1. A brand — `POST /api/admin/brands` (see [`brands.api.md`](./brands.api.md)). Paste its `_id` into a `brand_id` collection variable.
2. A category — `POST /api/admin/categories` (see [`categories.api.md`](./categories.api.md)). Paste its `_id` into a `category_id` collection variable.
3. (Optional) A specification schema for that category — `PUT /api/admin/categories/:id/specifications` (see [`categorySpecifications.api.md`](./categorySpecifications.api.md)) — only needed if you want to test `specifications` validation below.
4. At least one image object key — `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` with `"purpose": "product-image"` (see [`uploads.api.md`](./uploads.api.md)). Needed for the required variant image(s) below — a variant create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

**Optional collection variables:** add `product_id` and `variant_id` (leave both empty) so you can paste a created product's/variant's `_id` into them and reuse `{{product_id}}`/`{{variant_id}}` across the requests below.

---

## `POST /api/admin/products`

Creates a product — just its metadata. The slug is auto-generated from `name`. There is no `sku`/price/image/stock here at all (Issue #102) — add a variant afterward via `POST .../variants` below to make it sellable.

| Field  | Value                             |
| ------ | ---------------------------------- |
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
  "brand": "{{brand_id}}",
  "category": "{{category_id}}",
  "specifications": [],
  "isFeatured": false
}
```

- `name`, `description`, `brand`, `category` — all required (`FR-CAT-001`).
- `specifications` — optional, defaults to `[]`. If your category has a schema defined (see prerequisite 3), every value here is validated against it — see the error case below.
- `isFeatured` — optional, defaults to `false`.
- `sku`/`images`/`mrp`/`discount`/`stock`/`lowStockThreshold` are not recognized fields here — sending any of them has no effect (Zod strips unknown keys); they belong on a variant, added afterward.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "Nova Phone X1",
    "slug": "nova-phone-x1",
    "description": "A flagship phone with a 6.1-inch display.",
    "brand": "66a1f0c9e4b0a1a2b3c4d5e1",
    "category": "66a1f0c9e4b0a1a2b3c4d5e2",
    "specifications": [],
    "variants": [],
    "isFeatured": false,
    "status": "draft",
    "createdBy": null,
    "updatedBy": null,
    "createdAt": "2026-07-31T10:00:00.000Z",
    "updatedAt": "2026-07-31T10:00:00.000Z"
  }
}
```

- `slug` collision handling is identical to brands/categories: a numeric suffix (`-2`, `-3`, ...) is appended if the generated slug already exists.
- `status` always starts as `"draft"` — there's no way to create a product already `published`; use `PATCH .../status` below afterward, and it requires at least one active variant first (see that section's `PRODUCT_HAS_NO_VARIANTS` error case).
- `variants` is always `[]` on a freshly-created product — add variants afterward via `POST .../variants` below.
- `createdBy`/`updatedBy` are always `null` for now — reserved fields, unused until v0.3 authentication.
- Paste the returned `_id` into the `product_id` collection variable to use in the requests below.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint.

**Missing a required field (e.g. `category`):**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "category": "Invalid input: expected string, received undefined"
  }
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

Updates any editable field. All fields optional — send only what's changing.

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

**Body tab → raw → JSON** (example — updates the featured flag):

```json
{
  "isFeatured": true
}
```

**Click Send. Expected response — `200 OK`:** the full updated product, same shape as create's response.

- **Moving `category`** re-validates the product's specifications against the _new_ category's schema (`FR-CAT-034`) — even if you don't also submit new `specifications` in the same request, the existing stored values must satisfy the new schema, or the update is rejected naming the offending fields (same `SPECIFICATION_VALIDATION_FAILED` shape as create).
- Submitting `sku`/`images`/`mrp`/`discount`/`stock`/`lowStockThreshold` here is silently ignored, not rejected — none of them are recognized fields on a product (Issue #102). To change a variant's own price/images, use the variant endpoints below.

### Error cases

Same `INVALID_ID`/`PRODUCT_NOT_FOUND`, `VALIDATION_ERROR`, `BRAND_NOT_FOUND`/`CATEGORY_NOT_FOUND`, and `SPECIFICATION_VALIDATION_FAILED` cases as `POST` above.

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
| ------ | ---------------------------------- |
| Method | `GET`                             |
| URL    | `{{base_url}}/api/admin/products` |
| Name   | `List Products (Admin)`           |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Query params (all optional):**

| Param      | Values                                                                                     | Default      |
| ---------- | ------------------------------------------------------------------------------------------ | ------------ |
| `page`     | integer ≥ 1                                                                                | `1`          |
| `limit`    | integer 1–100                                                                              | `20`         |
| `sortBy`   | `createdAt` \| `name`                                                                      | `createdAt`  |
| `orderBy`  | `asc` \| `desc` \| `none`                                                                  | `desc`       |
| `search`   | free text — matched against `name` (partial, case-insensitive) and variant `sku` (exact-or-prefix) | omitted      |
| `status`   | `draft` \| `published` \| `archived`                                                       | omitted      |

_Amended, Issue #102: `mrp`/`stock` sort options and the `lowStock` filter are gone — the product no longer has either field._

_Amended, Issue #104: the combined `sort=-field` param is now two params, `sortBy`/`orderBy`, shared with the (also newly paginated/sortable) categories/brands admin lists below. `orderBy=none` returns results with no explicit sort applied at all._

Try: `{{base_url}}/api/admin/products?page=1&limit=10&sortBy=name&orderBy=desc`

Try search: `{{base_url}}/api/admin/products?search=NOVA-X1-001-BLK-128` — pasting a variant's full SKU returns exactly the product that owns it; `?search=nova` matches by name too, case-insensitively and partially (`FR-CAT-050`).

Try search + status together: `{{base_url}}/api/admin/products?search=nova&status=draft` — `status` narrows the result set `search` already produced; it doesn't replace it (`FR-CAT-053`). `search` alone still searches across **all** statuses, matching the admin grid's existing all-statuses visibility rule (`FR-CAT-005`).

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Nova Phone X1",
      "isFeatured": false,
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

- **`orderBy` controls direction, `sortBy` the field** — `sortBy=name&orderBy=desc` orders Z→A; `sortBy=name&orderBy=asc` orders A→Z; `orderBy=none` (or omitting both) applies no explicit sort.
- **`search` is a plain MongoDB query, not Atlas Search** — a case-insensitive, unanchored regex on `name`, `OR`ed with a `^`-anchored (exact-or-prefix) regex on `variants.sku`. Consistent with `search` on `GET /api/admin/categories`/`GET /api/admin/brands` — all three admin lists use the identical mechanism (`FR-CAT-050`–`052`).
- **`status` and `search` are independent filters, not mutually exclusive** — send either alone, both together, or neither. Neither one narrows the other incorrectly: `search` alone still spans all three statuses; adding `status` only ever removes results that don't also match `search`.
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

**An unrecognized `sortBy` value:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "sortBy": "Invalid option: expected one of \"createdAt\"|\"name\""
  }
}
```

**An unrecognized `status` value:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "status": "Invalid option: expected one of \"draft\"|\"published\"|\"archived\""
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
- Equivalent to `PATCH /api/admin/products/:id/status` with `{"status": "archived"}` below — same underlying write, different response shape (`null` here vs. the full product there).

### Error cases

**Malformed id:** same `INVALID_ID` shape as above.

**Nonexistent id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

---

## `PATCH /api/admin/products/:id/status`

Sets the product's status directly to any of the three states (`FR-CAT-045`) — not a toggle like brands'/categories' boolean `status`, since a product has three states, not two.

| Field  | Value                                                   |
| ------ | -------------------------------------------------------- |
| Method | `PATCH`                                                 |
| URL    | `{{base_url}}/api/admin/products/{{product_id}}/status` |
| Name   | `Update Product Status`                                 |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "status": "published" }
```

- `status` — one of `"draft"`, `"published"`, or `"archived"`.

**Click Send. Expected response — `200 OK`:** the full updated product, `status: "published"`, every other field unchanged.

- **This is the only way to publish a product** — `POST` above always creates a product as `"draft"`.
- **Publishing requires at least one active variant** (`FR-CAT-043`, Issue #102) — add one via `POST .../variants` below first, or this call 400s (see the error case below). `"draft"`/`"archived"` transitions have no such requirement.
- Setting `status: "archived"` here has the identical effect to `DELETE /api/admin/products/:id` above — both end up calling the same underlying status update; there's no difference in the stored result.
- **A product in a deactivated category or carrying a deactivated brand still keeps its own `status` here** (`FR-CAT-049`) — this endpoint only ever touches the product's own field, never its brand's/category's. Whether it actually appears in a _buyer_ listing for that category/brand once one exists (`#35`) is a separate, read-time concern this endpoint doesn't need to know about.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`.

**Nonexistent id:** same `PRODUCT_NOT_FOUND` shape as `GET :id` above.

**Publishing a product with zero active variants** (Issue #102):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "PRODUCT_HAS_NO_VARIANTS",
  "message": "Product 66a1f0c9e4b0a1a2b3c4d5e6 has no active variants and cannot be published."
}
```

**Unrecognized `status` value:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "status": "Invalid option: expected one of \"draft\"|\"published\"|\"archived\""
  }
}
```

---

## `POST /api/admin/products/:id/variants`

Adds a sellable variant to a product — its own SKU, attribute combination, price, and required images, the only place any of these fields exist (Issue #102).

| Field  | Value                                                     |
| ------ | ----------------------------------------------------------- |
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
  "images": [
    { "objectKey": "product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp", "isPrimary": true }
  ],
  "mrp": 104900,
  "discount": 10,
  "weight": 0.19
}
```

- `sku` — required, unique across every variant of every product (`FR-CAT-003`) — rejected if it collides with any other variant's `sku` anywhere, including a sibling on this same product. It **can** be changed later via `PATCH` (see below).
- `attributes` — required, 1+ `{name, value}` pairs. No two variants of this product (active or inactive) may share an identical set — order doesn't matter (`Color=Black, Storage=128GB` collides with `Storage=128GB, Color=Black`).
- `images` — **required**, 1 or 2 entries (Issue #102: there's no parent-product gallery to fall back to anymore), each an `objectKey` from a prior presign/direct-upload call. `isPrimary` is optional — if none is marked, the first image is auto-promoted (`FR-CAT-084`).
- `mrp` — required, positive integer paise (`FR-CAT-085`).
- `discount` — optional integer 0–99, defaults to `0` (`FR-CAT-086`).
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
        "images": [
          {
            "url": "https://cdn.example.com/product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
            "isPrimary": true
          }
        ],
        "mrp": 104900,
        "discount": 10,
        "sellingPrice": 94410,
        "weight": 0.19,
        "active": true,
        "createdAt": "2026-08-03T10:00:00.000Z",
        "updatedAt": "2026-08-03T10:00:00.000Z"
      }
    ]
  }
}
```

- **`sellingPrice: 94410`** — computed server-side (`104900 - floor(10490) = 94410`), never accepted from you.
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

**Missing `images` entirely** (Issue #102 — required, not optional):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "images": "Invalid input: expected array, received undefined"
  }
}
```

**`sku` colliding with a sibling variant's `sku`, or any other product's variant `sku`:**

```json
{
  "success": false,
  "code": "DUPLICATE_SKU",
  "message": "SKU \"NOVA-X1-001-BLK-128\" is already in use by another variant."
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

**Non-positive `mrp`, `discount: 100`, or non-positive `weight`:** same `VALIDATION_ERROR` shapes as `POST /api/admin/products` above.

**0 or more than 2 images** (Issue #102 — exactly 1 or 2 is required, 0 is no longer valid):

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
| ------ | -------------------------------------------------------------------------- |
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

- Updating `mrp` and/or `discount` recomputes `sellingPrice` the same way create does — submitting only one still recomputes correctly, using the variant's own currently-stored value for the other.
- `sku` can be changed here — re-validated against every sibling variant plus every other product's variants, identically to create.
- Changing `attributes` re-checks the duplicate-combination guard against every _other_ variant on this product.
- Sending new `images` replaces the variant's entire image array (same required 1–2 bound as create).
- Deactivating the last active variant on an already-published product is **not** blocked here — the publish-time guard (`PATCH .../status` above) only runs when transitioning _to_ `"published"`, not on every subsequent variant write. A documented, accepted gap.

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

**Recoding `sku` to collide with a sibling variant's `sku`, or any other product's variant `sku`:** same `DUPLICATE_SKU` shape as `POST .../variants` above.

**Changing `attributes` to duplicate a sibling variant's combination:** same `DUPLICATE_VARIANT_ATTRIBUTES` shape as `POST .../variants` above.

**Non-positive `mrp`, `discount: 100`, or non-positive `weight`:** same `VALIDATION_ERROR` shapes as `POST /api/admin/products` above.

---

## `GET /api/products`

Lists **published-only** products, paginated (`FR-CAT-054`). The first buyer-facing endpoint in this API — no `X-Admin-Key` header, and every response strips `status`/`createdBy`/`updatedBy` (`FR-CAT-095`). There is no `stock`/`lowStockThreshold`/`availability` anywhere in this system to strip (Issue #102) — every catalog entry is treated as always orderable.

| Field  | Value                       |
| ------ | ----------------------------- |
| Method | `GET`                       |
| URL    | `{{base_url}}/api/products` |
| Name   | `List Products (Buyer)`     |

No headers required, no body.

**Query params (all optional, and all compose together — FR-CAT-076):**

| Param                                     | Values                                                                                                                | Default   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------- |
| `page`                                    | integer ≥ 1                                                                                                           | `1`       |
| `limit`                                   | integer ≥ 1 — a value over `48` is **clamped** to `48`, not rejected                                                  | `24`      |
| `q`                                       | keyword search over `name`/`description` via MongoDB Atlas Search, fuzzy-matched (`FR-CAT-065`)                       | omitted   |
| `category`                                | a category **slug** — scopes the listing to that category plus its active subcategories (`FR-CAT-070`)                | omitted   |
| `brand`                                   | one or more brand ids — repeat the param (`?brand=a&brand=b`) or comma-join (`?brand=a,b`) (`FR-CAT-069`)             | omitted   |
| `minPrice`                                | integer paise, inclusive — matches a product with at least one active variant's `sellingPrice` in range (`FR-CAT-068`) | omitted   |
| `maxPrice`                                | integer paise, inclusive — same field as `minPrice`                                                                   | omitted   |
| `onSale`                                  | `true` (presence-based) — at least one active variant with `discount > 0` (`FR-CAT-074`)                              | omitted   |
| `attributeName`                           | a variant attribute name, e.g. `Color` — **must be submitted with `attributeValue`** (`FR-CAT-071`)                   | omitted   |
| `attributeValue`                          | the matching value, e.g. `Red`                                                                                        | omitted   |
| `spec[<name>]`                            | a filterable specification's value match, e.g. `?spec[RAM]=8GB` — for `enum`/`boolean` fields (`FR-CAT-072`)          | omitted   |
| `spec[<name>][min]` / `spec[<name>][max]` | a filterable `number` specification's range, e.g. `?spec[ScreenSize][min]=6&spec[ScreenSize][max]=6.5` (`FR-CAT-072`) | omitted   |
| `sort`                                    | `relevance` (only meaningful with `q`) \| `price_asc` \| `price_desc` \| `newest` (`FR-CAT-075`)                      | see below |

_Amended, Issue #102: `inStock` is gone — there is no stock concept, so no in-stock filter exists._

`sort`'s default: `relevance` when `q` is present, `newest` otherwise. `attributeName`/`attributeValue` and any `spec[...]` filter route the query through Atlas Search even with no `q` at all — see the scope note above. `minPrice`/`maxPrice`/`onSale` are plain-query filters and work with no Atlas cluster, same as before.

**Click Send. Try:** `{{base_url}}/api/products?category=smartphones&minPrice=20000&maxPrice=100000&sort=price_asc`

**Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Nova Phone X1",
      "slug": "nova-phone-x1",
      "brand": { "_id": "66a1f0c9e4b0a1a2b3c4d5e1", "name": "Nova", "slug": "nova" },
      "primaryImage": { "url": "https://cdn.example.com/product-image/a.webp" },
      "mrp": 104900,
      "discount": 10,
      "sellingPrice": 94410,
      "isFeatured": false,
      "cardSpecifications": [
        { "name": "Screen Size", "value": 6.1, "unit": "inch" },
        { "name": "RAM", "value": "8GB", "unit": null }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 24, "total": 1, "totalPages": 1, "hasNextPage": false }
}
```

- **`primaryImage`/`mrp`/`discount`/`sellingPrice` are the product's default variant's** — the lowest-`sellingPrice` **active** variant (`FR-CAT-064`) — not the product's own, since the product has none (Issue #102). If a product somehow has zero active variants (the documented `PRODUCT_HAS_NO_VARIANTS`-adjacent edge case — publishing already blocks this, but deactivating a product's last variant after publishing isn't separately guarded), all four fields are simply **absent**, not `null` or `0`.
- **`cardSpecifications`** (`FR-CAT-091`–`092`) is a category's first four `filterable` specification fields, in schema declaration order, always present — `[]` on a home/all-products listing (no shared category) or a category with no filterable fields defined. A field the product has no stored value for is skipped, not padded — a product with only two of a category's four filterable fields shows exactly two. `unit` is `null` (not omitted) when the field has none.
- **`sort=price_asc`/`price_desc` order by each product's lowest active-variant `sellingPrice`** (`FR-CAT-075`), not `mrp`, and not any product-level field (there isn't one).
- **An oversized `limit` is clamped, not rejected** — `?limit=1000` silently becomes `48`, the opposite of the admin list's `VALIDATION_ERROR` behavior (`FR-CAT-057`).
- **An empty result set is still a `200` with `data: []`**, never a `404` or an error (`FR-CAT-058`) — true for every filter combination, including one that matches nothing.
- **`category` resolves the same way `GET /api/categories/:slug/products` does** — an inactive or nonexistent slug 404s as `CATEGORY_NOT_FOUND`, not an empty result.

### Error cases

**`attributeName` submitted without `attributeValue` (or vice versa):**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": { "attributeValue": "attributeName and attributeValue must be submitted together." }
}
```

**An invalid brand id in `brand`:**

```json
{ "success": false, "code": "VALIDATION_ERROR", "errors": { "brand": "Must be a list of valid ids." } }
```

**A `spec[...]` filter naming a field that isn't `filterable` for the resolved category** (only checked when `category` is also present — see "What's Not Here Yet" below for the unscoped case):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_SPECIFICATION_FILTER",
  "message": "\"Resolution\" is not a filterable specification field for this category."
}
```

Same code for a shape mismatch — e.g. `spec[RAM]=8GB` against a field whose type is actually `number` (which only accepts `spec[RAM][min]`/`[max]`), or a range filter against an `enum`/`boolean` field.

---

## `GET /api/products/:slug`

Fetches a single **published** product's detail by slug, not id — the buyer-facing key (`FR-CAT-056`), since catalog pages are ISR-rendered and the slug is both the cache key and the SEO-visible URL. A `draft`/`archived` product's slug 404s exactly like a slug that was never assigned (`FR-CAT-060`) — this endpoint never reveals that a non-published product exists.

| Field  | Value                                     |
| ------ | -------------------------------------------- |
| Method | `GET`                                     |
| URL    | `{{base_url}}/api/products/nova-phone-x1` |
| Name   | `Get Product (Buyer)`                     |

No headers required, no body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "Nova Phone X1",
    "slug": "nova-phone-x1",
    "description": "A flagship phone with a 6.1-inch display.",
    "brand": { "_id": "66a1f0c9e4b0a1a2b3c4d5e1", "name": "Nova", "slug": "nova" },
    "category": { "_id": "66a1f0c9e4b0a1a2b3c4d5e2", "name": "Electronics", "slug": "electronics" },
    "mrp": 104900,
    "discount": 10,
    "sellingPrice": 94410,
    "isFeatured": false,
    "specifications": [],
    "hasVariants": true,
    "defaultVariantId": "66a1f0c9e4b0a1a2b3c4d5e9",
    "variants": [
      {
        "_id": "66a1f0c9e4b0a1a2b3c4d5e9",
        "sku": "NOVA-X1-001-BLK-128",
        "attributes": [
          { "name": "Color", "value": "Black" },
          { "name": "Storage", "value": "128GB" }
        ],
        "images": [
          {
            "url": "https://cdn.example.com/product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
            "isPrimary": true
          }
        ],
        "mrp": 104900,
        "discount": 10,
        "sellingPrice": 94410,
        "weight": 0.19
      }
    ],
    "metaTitle": "Nova Phone X1",
    "metaDescription": "A flagship phone with a 6.1-inch display."
  }
}
```

- **There is no top-level `sku` or `images`** (Issue #102) — every image and every SKU lives per-variant now (`variants[].sku`/`variants[].images`); the buyer product-detail gallery is whichever variant is selected, starting with the default variant's own required images.
- **`hasVariants`/`variants`/`defaultVariantId`/`mrp`/`discount`/`sellingPrice` (`FR-CAT-064`)**: when the product has at least one *active* variant, `hasVariants` is `true`, `variants` lists only the active ones (inactive variants never appear here), and `defaultVariantId` is the id of the lowest-`sellingPrice` active variant — that variant's own `mrp`/`discount`/`sellingPrice` become this response's top-level values too. With **no** active variant (the documented edge case noted under `GET /api/products` above), `defaultVariantId`/`mrp`/`discount`/`sellingPrice` are all simply **absent**, not `null` — there's no product-level value to fall back to.
- **`specifications` lists every stored group/value, filterable or not** (`FR-CAT-063`) — unlike a category card (`#36`), the detail page draws no distinction.
- **`metaTitle`/`metaDescription` fall back to `name`/a truncated `description`** when unset (`FR-CAT-012`) — the same formula categories' own public list already uses.

### Error cases

**Malformed/empty slug segment:**

```
400 Bad Request
```

```json
{ "success": false, "code": "INVALID_SLUG", "message": "\"\" is not a valid slug." }
```

**Slug doesn't match any published product** (never existed, or exists but is `draft`/`archived`):

```
404 Not Found
```

```json
{
  "success": false,
  "code": "PRODUCT_NOT_FOUND",
  "message": "Product \"not-a-real-slug\" was not found."
}
```

---

## Error Code Reference

Product-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `OBJECT_KEY_NOT_ISSUED`, `IMAGE_COUNT_OUT_OF_BOUNDS`), [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`, `BRAND_NOT_FOUND`), [`categories.api.md`](./categories.api.md#error-code-reference) (`CATEGORY_NOT_FOUND`), and [`categorySpecifications.api.md`](./categorySpecifications.api.md#error-code-reference):

| Code                              | Status | Where it comes from                                                                                                                                                                                       | Reachable via an existing endpoint?                                       |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `PRODUCT_NOT_FOUND`               | 404    | `products.service.ts` — `:id`/`:slug` doesn't match any product (buyer: only a _published_ product counts a match)                                                                                        | Yes                                                                       |
| `VARIANT_NOT_FOUND`               | 404    | `products.service.ts`'s `updateVariant()` — `:variantId` doesn't match any variant on that product                                                                                                        | Yes                                                                       |
| `DUPLICATE_SKU`                   | 400    | `products.service.ts` — a variant's `sku` collides with any other variant's `sku` anywhere (including a sibling on the same product)                                                                      | Yes                                                                       |
| `DUPLICATE_VARIANT_ATTRIBUTES`    | 400    | `products.service.ts`'s `addVariant()`/`updateVariant()` — the attribute-pair set duplicates another variant's on the same product                                                                        | Yes                                                                       |
| `SPECIFICATION_VALIDATION_FAILED` | 400    | `categorySpecifications.service.ts`'s `validateProductSpecifications()`, called from `products.service.ts` on create and on category-changing update                                                      | Yes — requires a specification schema defined first                       |
| `PRODUCT_HAS_NO_VARIANTS`         | 400    | `products.service.ts`'s `updateProductStatus()` — `PATCH .../status` to `"published"` on a product with zero active variants (Issue #102)                                                                 | Yes                                                                       |
| `INVALID_SLUG`                    | 400    | `src/utils/routeParams.ts`'s `parseSlugParam()` — the `:slug` segment is empty/malformed                                                                                                                  | Yes                                                                       |
| `INVALID_SPECIFICATION_FILTER`    | 400    | `products.service.ts`'s `resolveSpecFilters()` — a `spec[...]` query filter names a field that isn't filterable for the resolved category, or uses the wrong shape (value vs. range) for the field's type | Yes — only checked when `category`/the nested route resolves one category |

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For products, the fields that can appear as keys include `name`, `description`, `brand`, `category`, `specifications`, `isFeatured`, `metaTitle`, `metaDescription`, and — on the admin list endpoint — `page`, `limit`, `sortBy`, `orderBy`, `search`, `status`. For the two variant endpoints: `sku`, `attributes`, `images`, `mrp`, `discount`, `weight`. For the status endpoint: `status`. For the buyer list endpoint (`GET /api/products`): `page`, `limit`, `q`, `category`, `brand`, `minPrice`, `maxPrice`, `attributeValue` (the both-or-neither check with `attributeName` surfaces here). `INVALID_SPECIFICATION_FILTER` and `PRODUCT_HAS_NO_VARIANTS` (above) are separate, service-level errors — not `VALIDATION_ERROR` — since each needs more than just the request shape to evaluate.

---

## What's Not Here Yet

This document is a snapshot of Issues #31, #32, #33 (status endpoint), #34 (`search`/`status` filtering), #35 (buyer browsing), #36 (buyer filtering/sorting/card content), and #102 (SRS v0.2 amendment — variant-only pricing, folded into this same doc) — this is the full Product Catalog API (M2 + the #102 amendment) for this entity.

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
