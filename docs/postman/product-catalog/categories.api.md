# Postman Manual — TechCart Backend API (Categories)

A step-by-step guide to testing the Category management endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #28 (M2.4 — Category management, `FR-CAT-014`–`022`), Issue #33 (M2.9 — Status update APIs, `FR-CAT-046`, `048` for this entity), Issue #34 (M2.10 — Admin search, `FR-CAT-051` for this entity), Issue #35 (M2.11 — Buyer browsing, `FR-CAT-055`, `066` for this entity), Issue #36 (M2.12 — Buyer filtering & sorting, `FR-CAT-070`–`076`, `092` for this entity's `:slug/products` route), and Issue #326 (M2 amendment — buyer faceted filter discovery, `FR-CAT-101`): the five admin CRUD endpoints under `/api/admin/categories`, the status-toggle endpoint, `search` on the admin list, the public `GET /api/categories`, `GET /api/categories/search`, `GET /api/categories/:slug/products`, and `GET /api/categories/:slug/filters` (this last one returns *product* data and shares the full buyer filter/sort surface — see [`products.api.md`](./products.api.md), the module its controller actually lives in). See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup (`base_url` variable); the admin routes here send `Authorization: Bearer {{admin_access_token}}` from [`../authentication/auth.api.md`](../authentication/auth.api.md)'s admin sign-in. See [`brands.api.md`](./brands.api.md) for the sibling entity this module closely mirrors. This doc assumes collection setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, and an `admin_access_token` collection variable set from [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup)'s admin sign-in (password + OTP, as a `catalog-manager` or `super-admin`). A category's `image` field is optional and, if you want to test it, requires first getting an `objectKey` from `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` with `"purpose": "category-image"` (see that doc) — a category create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

**Optional collection variables:** add `category_id` and `parent_category_id` (leave both empty) so you can paste created categories' `_id`s into them and reuse `{{category_id}}`/`{{parent_category_id}}` across the requests below — you'll need two categories to exercise the hierarchy behavior (a top-level one to use as a parent, and a second one to assign it to).

---

## Related Endpoints — Specifications

Each category can also have its own specification schema — the set of specification fields (name, type, whether it's required/filterable) that products in that category are allowed to carry. It's a large, structurally distinct resource (nested groups of fields, no `slug`/`status`, no public endpoint of its own), so it's documented separately rather than folded into this file:

| Method  | Path                                                | Purpose                                                          |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| `GET`   | `/api/admin/categories/:id/specifications`           | Read a category's specification schema                          |
| `PUT`   | `/api/admin/categories/:id/specifications`           | Define or replace the schema                                    |
| `PATCH` | `/api/admin/categories/:id/specifications`           | Targeted update: rename/delete a group, update/delete a field   |

Full request/response examples, error cases, and the four `PATCH` operation shapes (`renameGroup`/`deleteGroup`/`updateField`/`deleteField`): see [`categorySpecifications.api.md`](./categorySpecifications.api.md).

---

## Related Endpoints — Variant Types

Each category can also define its own variant axes (e.g. `Color`, `Size`) — a form-rendering guide the admin product-variant editor uses to pick the right input control per axis. Same `GET`/`PUT`/`PATCH`-only shape as Specifications above, but flat (no groups) and with **no in-use delete guard** — deleting an axis always succeeds, even while products hold variants using it:

| Method  | Path                                  | Purpose                                          |
| ------- | -------------------------------------- | --------------------------------------------------- |
| `GET`   | `/api/admin/categories/:id/variant-types` | Read a category's variant axes                   |
| `PUT`   | `/api/admin/categories/:id/variant-types` | Define or replace the axis list                  |
| `PATCH` | `/api/admin/categories/:id/variant-types` | Targeted update: replace or delete a single axis |

Full request/response examples, error cases, and the two `PATCH` operation shapes (`updateAxis`/`deleteAxis`): see [`categoryVariants.api.md`](./categoryVariants.api.md).

---

## `POST /api/admin/categories`

Creates a category. The slug is auto-generated from `name` server-side, same as brands. Categories are at most **two levels deep** — a category with a `parentCategory` cannot itself be given children.

| Field  | Value                              |
| ------ | ------------------------------------ |
| Method | `POST`                               |
| URL    | `{{base_url}}/api/admin/categories`  |
| Name   | `Create Category`                    |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (top-level category, no parent):

```json
{
  "name": "Electronics",
  "description": "Phones, laptops, and other electronics.",
  "sortOrder": 0,
  "metaTitle": "Electronics",
  "metaDescription": "Shop electronics at TechCart."
}
```

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
    "name": "Electronics",
    "slug": "electronics",
    "parentCategory": null,
    "description": "Phones, laptops, and other electronics.",
    "sortOrder": 0,
    "status": true,
    "metaTitle": "Electronics",
    "metaDescription": "Shop electronics at TechCart.",
    "createdBy": null,
    "updatedBy": null,
    "createdAt": "2026-07-30T10:00:00.000Z",
    "updatedAt": "2026-07-30T10:00:00.000Z"
  }
}
```

Paste the returned `_id` into `category_id` (this becomes your top-level `parent_category_id` for the next request).

**To create a subcategory**, send a second request with `parentCategory` set to the id from above:

```json
{
  "name": "Phones",
  "parentCategory": "{{category_id}}"
}
```

- `name` — required, non-empty.
- `description`, `sortOrder`, `metaTitle`, `metaDescription`, `image` — all optional. `description` is an implementation addition beyond the SRS's own schema table, added so `metaDescription` has something to truncate from (see [`GET /api/categories`](#get-apicategories) below).
- `parentCategory` — optional. Must be a valid, existing category id, and that category must not itself already have a parent (categories are at most two levels deep).
- `image` — optional, same `{objectKey, alt}` shape as a brand logo (no `isPrimary`).
- `metaTitle`/`metaDescription` here are the **raw stored values** — this endpoint (and `PATCH`/`GET :id`) never applies the fallback described below; only the public list does.

### Error cases

**Missing or invalid bearer token:** `401 UNAUTHENTICATED` (or `403 FORBIDDEN` for a valid session whose role isn't `catalog-manager`/`super-admin`) — same shape as every other admin endpoint (see [Error Code Reference](#error-code-reference)).

**Missing `name`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "name": "Invalid input: expected string, received undefined"
  }
}
```

**`parentCategory` isn't a valid id format** (e.g. `"parentCategory": "not-an-id"`):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "parentCategory": "Must be a valid id."
  }
}
```

**`parentCategory` doesn't match any existing category:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "PARENT_CATEGORY_NOT_FOUND",
  "message": "Parent category 66a1f0c9e4b0a1a2b3c4d5e6 was not found."
}
```

**`parentCategory` already has a parent of its own** (attempting a 3rd level):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "PARENT_CATEGORY_TOO_DEEP",
  "message": "The selected parent category already has a parent — categories may be at most two levels deep."
}
```

**`image.objectKey` was never issued, or was already consumed:** same `OBJECT_KEY_NOT_ISSUED` shape as [`brands.api.md`](./brands.api.md#post-apiadminbrands).

---

## `PATCH /api/admin/categories/:id`

Updates `name`, `description`, `parentCategory`, `image`, `sortOrder`, `metaTitle`, and/or `metaDescription`. All fields optional — send only what's changing.

| Field  | Value                                          |
| ------ | ------------------------------------------------ |
| Method | `PATCH`                                          |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}` |
| Name   | `Update Category`                                |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** — `parentCategory` is the only field in this whole API with three distinct behaviors depending on how it's sent:

Omit the key entirely and the parent is left unchanged:

```json
{ "sortOrder": 1 }
```

Send an explicit `null` to promote the category to top-level (clears its parent):

```json
{ "parentCategory": null }
```

Send a valid category id to set or change the parent:

```json
{ "parentCategory": "{{parent_category_id}}" }
```

**Click Send. Expected response — `200 OK`:** the full updated category, same shape as create's response.

- **The slug never changes**, even if you also send a new `name` — same reasoning as brands (`FR-CAT-016` only lists name/parent/image/sortOrder/SEO fields as updatable, not slug).
- Setting `parentCategory` re-runs the same hierarchy validation as create, **plus one check create never needs**: if this category already has subcategories of its own, giving it a parent is rejected (would create a 3-level chain from the other direction — see below).
- Setting a new `image.objectKey` consumes it and replaces the stored image, exactly like create.
- Omitted fields are left untouched.

### Error cases

Same `INVALID_ID` (malformed `:id`) and `CATEGORY_NOT_FOUND` (no such category) as [`GET /api/admin/categories/:id`](#get-apiadmincategoriesid), and the same `VALIDATION_ERROR`/`PARENT_CATEGORY_NOT_FOUND`/`PARENT_CATEGORY_TOO_DEEP`/`OBJECT_KEY_NOT_ISSUED` cases as create, plus two more:

**Setting a category as its own parent** (`"parentCategory": "{{category_id}}"` on that same category):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "INVALID_PARENT_CATEGORY",
  "message": "A category cannot be its own parent."
}
```

**Assigning a parent to a category that already has subcategories** (e.g. trying to give `Electronics` a parent after `Phones` was created under it above):

```json
{
  "success": false,
  "code": "CATEGORY_HAS_SUBCATEGORIES",
  "message": "This category already has subcategories and cannot also be given a parent."
}
```

---

## `PATCH /api/admin/categories/:id/status`

Toggles the category's boolean `status` (`FR-CAT-046`) — active/inactive, not a soft delete. A dedicated endpoint rather than folded into the general `PATCH` above, matching brands'/products' own status endpoints.

| Field  | Value                                                    |
| ------ | ------------------------------------------------------------ |
| Method | `PATCH`                                                       |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/status`   |
| Name   | `Update Category Status`                                      |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "status": false }
```

**Click Send. Expected response — `200 OK`:** the full updated category, `status: false`, every other field unchanged.

- **Deactivating never checks or bypasses the `DELETE` guard below** (`FR-CAT-048`) — a category referenced by products/subcategories can always be deactivated; only an actual `DELETE` is blocked while either reference exists.
- **Immediately hides the category from `GET /api/categories`** below (`FR-CAT-048`) — that endpoint already filters `status: true`, so no separate propagation step is needed. `GET /api/admin/categories/:id` still returns it regardless of `status`.
- Re-run with `{"status": true}` to reactivate.

### Error cases

**Missing or invalid bearer token:** `401 UNAUTHENTICATED`.

**Nonexistent id:** same `CATEGORY_NOT_FOUND` shape as `GET :id` above.

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

## `GET /api/admin/categories`

Lists every category, any status, each with its `parentCategory` and its product count — paginated and sortable (`FR-CAT-017`, Issue #104).

| Field  | Value                              |
| ------ | ------------------------------------ |
| Method | `GET`                                |
| URL    | `{{base_url}}/api/admin/categories`  |
| Name   | `List Categories (Admin)`            |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param     | Values                                                           | Default |
| --------- | ----------------------------------------------------------------- | ------- |
| `page`    | integer ≥ 1                                                        | `1`     |
| `limit`   | integer 1–100                                                      | `20`    |
| `sortBy`  | `name` \| `sortOrder` \| `createdAt`                              | omitted |
| `orderBy` | `asc` \| `desc` \| `none`                                          | `none`  |
| `search`  | free text — matched against `name`, partial and case-insensitive  | omitted |

Try: `{{base_url}}/api/admin/categories?search=elec` — matches "Electronics" regardless of case or position within the name (`FR-CAT-051`).

Try pagination + sort: `{{base_url}}/api/admin/categories?page=1&limit=10&sortBy=sortOrder&orderBy=asc`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Electronics",
      "slug": "electronics",
      "parentCategory": null,
      "sortOrder": 0,
      "status": true,
      "createdBy": null,
      "updatedBy": null,
      "createdAt": "2026-07-30T10:00:00.000Z",
      "updatedAt": "2026-07-30T10:00:00.000Z",
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

- `productCount` reflects products of **any** status directly assigned to that category — not counting products in its subcategories. Create a product against this category via [`products.api.md`](./products.api.md) (`#31`) to see this go above `0`.
- Each item's `parentCategory` is a raw id (or `null`) — this is a **flat array, not a nested tree**. Build the two-level hierarchy client-side by grouping on `parentCategory`.
- **Amended, Issue #104: paginated and sortable, same shape as [`GET /api/admin/products`](./products.api.md#get-apiadminproducts)** — previously this endpoint returned every category unpaginated with no guaranteed order. `orderBy` defaults to `none` (no `sortBy` default either) so a request with no sort params still returns the same unordered result this endpoint always has.
- `search` spans **all** statuses, same as the unfiltered list — it doesn't hide inactive categories.
- `search` is a plain MongoDB regex query, not Atlas Search — same mechanism as `search` on [`GET /api/admin/products`](./products.api.md#get-apiadminproducts) and [`GET /api/admin/brands`](./brands.api.md#get-apiadminbrands) (`FR-CAT-050`–`052`).

---

## `GET /api/admin/categories/:id`

Fetches a single category by id, any status.

| Field  | Value                                              |
| ------ | ------------------------------------------------------ |
| Method | `GET`                                                  |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}`    |
| Name   | `Get Category (Admin)`                                 |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`.

**Click Send. Expected response — `200 OK`:** same shape as a single item from the list above, minus `productCount`.

### Error cases

**Malformed id:**

```json
{
  "success": false,
  "code": "INVALID_ID",
  "message": "\"not-an-id\" is not a valid id."
}
```

**Well-formed id that doesn't match any category:**

```
404 Not Found
```

```json
{
  "success": false,
  "code": "CATEGORY_NOT_FOUND",
  "message": "Category 66a1f0c9e4b0a1a2b3c4d5e6 was not found."
}
```

---

## `DELETE /api/admin/categories/:id`

Deletes a category — but only if it has **zero** products directly assigned to it **and** zero subcategories (`FR-CAT-019`). Create a product against this category via [`products.api.md`](./products.api.md) (`#31`) to exercise the product half of this guard.

| Field  | Value                                              |
| ------ | ------------------------------------------------------ |
| Method | `DELETE`                                               |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}`    |
| Name   | `Delete Category`                                      |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": null
}
```

- **Note:** deleting an id that doesn't match any category also returns this same `200`/`data: null` response, not a `404` — same behavior as brands (the guard only checks "how many products/subcategories reference this id," both naturally zero for a nonexistent id).

### Error cases

**Malformed id:** same `INVALID_ID` shape as above.

**Category has subcategories** (try deleting the parent from the [create](#post-apiadmincategories) example above, before deleting `Phones`):

```
409 Conflict
```

```json
{
  "success": false,
  "code": "CATEGORY_IN_USE",
  "message": "Cannot delete category: referenced by 1 subcategory(ies)."
}
```

**Category has both products and subcategories** — the message names both, in one response:

```json
{
  "success": false,
  "code": "CATEGORY_IN_USE",
  "message": "Cannot delete category: referenced by 2 product(s) and 1 subcategory(ies)."
}
```

---

## `GET /api/categories`

Public, buyer-facing category list — active categories only, ordered, display fields only. No auth header needed.

| Field  | Value                       |
| ------ | ------------------------------ |
| Method | `GET`                          |
| URL    | `{{base_url}}/api/categories`  |
| Name   | `List Categories (Public)`     |

No headers, no body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66a1f0c9e4b0a1a2b3c4d5e6",
      "name": "Electronics",
      "slug": "electronics",
      "parentCategory": null,
      "sortOrder": 0,
      "metaTitle": "Electronics",
      "metaDescription": "Shop electronics at TechCart."
    }
  ]
}
```

- **Ordered by `sortOrder` ascending, then `name` ascending** (`FR-CAT-020`) — unlike the admin list. Create a few categories with different `sortOrder` values to see this.
- Only `status: true` categories are returned — deactivate one via `PATCH /api/admin/categories/:id/status` above to see it drop out of this list.
- **`metaTitle`/`metaDescription` are always present here**, unlike the admin endpoints — this is the one place the SEO fallback (`FR-CAT-022`) is actually applied:
  - `metaTitle` falls back to `name` when unset.
  - `metaDescription` falls back to a 160-character, word-boundary-safe truncation of `description` when unset; if there's no `description` either, it falls back to `name`.
- `status`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` are stripped entirely.
- `image` is included only when the category has one.
- No auth header required.

---

## `GET /api/categories/search`

Searches active categories by name — case-insensitive, partial match (`FR-CAT-066`). A plain MongoDB regex query, not Atlas Search — `categories` is too small a collection to warrant a second search index (unlike products' `?q=`, [`products.api.md`](./products.api.md)).

| Field  | Value                                       |
| ------ | ------------------------------------------- |
| Method | `GET`                                       |
| URL    | `{{base_url}}/api/categories/search?q=elec` |
| Name   | `Search Categories (Buyer)`                 |

No headers, no body.

**Query params:**

| Param | Values                            | Required? |
| ----- | --------------------------------- | --------- |
| `q`   | free text, matched against `name` | Yes       |

**Click Send. Expected response — `200 OK`:** same item shape as `GET /api/categories` above, filtered to names matching `q` — `?q=elec` matches "Electronics" regardless of case or position within the name. `q` still only searches **active** categories, same as the unfiltered list.

### Error cases

**Missing `q`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": { "q": "Invalid input: expected string, received undefined" }
}
```

---

## `GET /api/categories/:slug/products`

Lists **published-only** products within a category, including its subcategories (`FR-CAT-055`) — the response is product data, so its controller (`listProductsByCategorySlugHandler`) actually lives in `products.controller.ts`; only this route's wiring is declared here. See [`products.api.md`](./products.api.md#get-apiproducts) for the item shape (including `cardSpecifications`) and pagination-clamp behavior — identical to the flat `GET /api/products` listing, just scoped to this one category (and its direct subcategories; categories are at most two levels deep, so that already covers the whole subtree).

| Field  | Value                                              |
| ------ | -------------------------------------------------- |
| Method | `GET`                                              |
| URL    | `{{base_url}}/api/categories/electronics/products` |
| Name   | `List Products by Category (Buyer)`                |

No headers, no body. **Every filter/sort param `GET /api/products` accepts also works here** — `brand`, `minPrice`/`maxPrice`, `onSale`, `attributeName`/`attributeValue`, `spec[...]`, `sort` (`FR-CAT-076`) — with two differences: there's no `q` (keyword search stays flat-listing-only) and no `category` param (this route's `:slug` already fixes it).

**Click Send. Try:** `{{base_url}}/api/categories/electronics/products?minPrice=20000&onSale=true&sort=price_asc`

**Expected response — `200 OK`:** identical envelope shape to `GET /api/products`, scoped to the resolved category (and its active subcategories).

- **Only an *active* category's slug resolves** — a deactivated category's slug 404s here exactly like a slug that never existed, mirroring the buyer-facing `GET /api/categories` list already excluding it.
- **Subcategory expansion is direct children only** — categories are at most two levels deep, so a parent's direct active children already cover the whole subtree; querying a subcategory's own slug scopes to just that subcategory (it has no children of its own).
- **A `spec[...]` filter is validated against *this resolved category's* schema** (`FR-CAT-072`/`035`) — a field that isn't `filterable` here, or a value/range shape mismatched to its actual type, 400s as `INVALID_SPECIFICATION_FILTER`. Unlike the flat `GET /api/products?category=` case (same validation, same code), there's no "unscoped, unvalidated" fallback on this route — a category is always resolved before any filter is evaluated.
- **`cardSpecifications` on each item reflects that item's *own* category** — normally the same category this route scoped to, but a subcategory's products can carry a different schema than the parent's, so this isn't guaranteed uniform across the page.

### Error cases

**Slug doesn't resolve to an active category:**

```
404 Not Found
```

```json
{ "success": false, "code": "CATEGORY_NOT_FOUND", "message": "Category \"missing\" was not found." }
```

**A `spec[...]` filter naming a field that isn't filterable for this category, or the wrong value/range shape for its type** — same `INVALID_SPECIFICATION_FILTER` shape as `GET /api/products`, see [`products.api.md`](./products.api.md#get-apiproducts).

---

## `GET /api/categories/:slug/filters`

Category-scoped **filter options** for the buyer filter rail (`FR-CAT-101`, Issue #326) — a single discovery object, not a product list. Everything is scoped to the resolved category **and its direct active subcategories**, the same subtree `:slug/products` uses.

| Field  | Value                                             |
| ------ | ------------------------------------------------- |
| Method | `GET`                                             |
| URL    | `{{base_url}}/api/categories/electronics/filters` |
| Name   | `Category Filter Options (Buyer)`                 |

No headers, no body, no query params.

**Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "category": { "_id": "66a4f1c8e3b7a91d2c8f4c00", "name": "Smartphones", "slug": "smartphones" },
    "brands": [
      { "_id": "66a4f1c8e3b7a91d2c8f4a10", "name": "Nova", "slug": "nova", "productCount": 42 },
      { "_id": "66a4f1c8e3b7a91d2c8f4a11", "name": "Zephyr", "slug": "zephyr", "productCount": 17 }
    ],
    "priceRange": { "min": 799900, "max": 15499900 },
    "specifications": [
      { "name": "Screen Size", "unit": "inch", "type": "number", "min": 5.4, "max": 6.9 },
      { "name": "RAM", "unit": null, "type": "enum", "options": ["6GB", "8GB", "12GB"] },
      { "name": "5G", "unit": null, "type": "boolean" }
    ],
    "variantAxes": [
      { "name": "Colour", "code": "colour", "type": "color",
        "options": [{ "label": "Midnight Black", "value": "midnight-black" }] }
    ]
  }
}
```

- **`brands`** — only brands with ≥1 `published` product in scope, each with an accurate `productCount`; inactive brands and brands with no in-scope product are omitted, sorted by name.
- **`priceRange`** — `{ min, max }` across every active variant's `sellingPrice` in scope, or `null` when nothing in scope has an active variant.
- **`specifications`** — the category's `filterable` fields in schema declaration order: `options` on `enum`, computed `{ min, max }` from real product data on `number` (omitted when no in-scope product carries a numeric value for it), `unit` is `null` when the field declares none. `text` fields never appear.
- **`variantAxes`** — the category's variant-type definition (`GET /api/admin/categories/:id/variant-types`), name/code/type/options.
- **No `pagination` key** — this is a single object, not a list.

### Error cases

**Slug doesn't resolve to an active category** — identical to `:slug/products`:

```json
{ "success": false, "code": "CATEGORY_NOT_FOUND", "message": "Category \"missing\" was not found." }
```

---

## Error Code Reference

Category-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `OBJECT_KEY_NOT_ISSUED`) and [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                         | Status | Where it comes from                                                                                                                                                     | Reachable via an existing endpoint?                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `CATEGORY_NOT_FOUND`         | 404    | `categories.service.ts` — `GET`/`PATCH`/`PATCH .../status` by an id with no matching category, or `GET .../:slug/products` / `GET .../:slug/filters` by a slug with no matching *active* category | Yes                                                                         |
| `INVALID_PARENT_CATEGORY`    | 400    | `categories.service.ts`'s `validateParentCategory()` — `parentCategory` set to the category's own id                                                                    | Yes (on `PATCH` only — create can't self-reference, no id yet)              |
| `PARENT_CATEGORY_NOT_FOUND`  | 404    | same — the referenced `parentCategory` doesn't exist                                                                                                                    | Yes                                                                         |
| `PARENT_CATEGORY_TOO_DEEP`   | 400    | same — the referenced `parentCategory` already has a parent of its own                                                                                                  | Yes                                                                         |
| `CATEGORY_HAS_SUBCATEGORIES` | 400    | same — update-only: this category already has children and can't also be given a parent                                                                                 | Yes                                                                         |
| `CATEGORY_IN_USE`            | 409    | `categories.service.ts`'s `deleteCategory()` — referenced by ≥1 product and/or ≥1 subcategory                                                                           | Yes — see [`products.api.md`](./products.api.md) (#31) for the product case |

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For categories, the fields that can appear as keys are `name`, `description`, `parentCategory`, `image.objectKey`, `image.alt`, `sortOrder`, `metaTitle`, `metaDescription`, and — on the admin list endpoint — `page`, `limit`, `sortBy`, `orderBy`, `search`. `GET /api/categories/search` requires `q`; `GET /api/categories/:slug/products` accepts `page`, `limit`, and the full filter/sort field set documented in [`products.api.md`](./products.api.md#understanding-validation-errors) (`brand`, `minPrice`, `maxPrice`, `attributeValue`, ...). `INVALID_SPECIFICATION_FILTER` (also on `:slug/products`) is a separate, service-level error, not a `VALIDATION_ERROR`.

---

## What's Not Here Yet

This document is a snapshot of Issue #28 (plus #33's status endpoint, #34's `search` param, #35's `/search`+`/:slug/products` routes, and #36's filter/sort surface on `/:slug/products`, folded into this same doc) — this is the full Product Catalog API (M2) for this entity; M2 closed with #36. Category-governed specifications (`#29`) is now covered in [`categorySpecifications.api.md`](./categorySpecifications.api.md), category-governed variant types (`#30`) in [`categoryVariants.api.md`](./categoryVariants.api.md) — together they cover both halves of `DELETE`'s cascade clause — and product core CRUD plus product variants (`#31`, `#32`) in [`products.api.md`](./products.api.md), which also completes `DELETE`'s product half of the `CATEGORY_IN_USE` guard above.

Admin authentication is real session + RBAC — send `Authorization: Bearer <token>` from an admin sign-in (`src/middleware/rbac.ts`), see [`../authentication/auth.api.md`](../authentication/auth.api.md). The former `X-Admin-Key` placeholder was removed by Issue #143/M3.5.
