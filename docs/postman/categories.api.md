# Postman Manual — TechCart Backend API (Categories)

A step-by-step guide to testing the Category management endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #28 (M2.4 — Category management, `FR-CAT-014`–`022`): the five admin endpoints under `/api/admin/categories` and the public `GET /api/categories`. It's deliberately scoped to issue #28's own checklist — there is **no** status-toggle endpoint (`PATCH /api/admin/categories/:id/status`, `FR-CAT-046`) and **no** search on the admin list (`FR-CAT-051`) yet; both are separate, later issues (#33, #34) that wait until brands, categories, and products all exist. See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup (`base_url`, `admin_api_key` variables); see [`brands.api.md`](./brands.api.md) for the sibling entity this module closely mirrors. This doc assumes collection setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set. A category's `image` field is optional and, if you want to test it, requires first getting an `objectKey` from `POST /api/admin/uploads/presign` or `POST /api/admin/uploads/direct` with `"purpose": "category-image"` (see that doc) — a category create/update rejects any `objectKey` that wasn't actually issued by one of those two endpoints.

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

## `POST /api/admin/categories`

Creates a category. The slug is auto-generated from `name` server-side, same as brands. Categories are at most **two levels deep** — a category with a `parentCategory` cannot itself be given children.

| Field  | Value                              |
| ------ | ------------------------------------ |
| Method | `POST`                               |
| URL    | `{{base_url}}/api/admin/categories`  |
| Name   | `Create Category`                    |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
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

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint (see [Error Code Reference](#error-code-reference)).

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
X-Admin-Key: {{admin_api_key}}
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

## `GET /api/admin/categories`

Lists every category, any status, each with its `parentCategory` and its product count.

| Field  | Value                              |
| ------ | ------------------------------------ |
| Method | `GET`                                |
| URL    | `{{base_url}}/api/admin/categories`  |
| Name   | `List Categories (Admin)`            |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

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
  ]
}
```

- `productCount` reflects products of **any** status directly assigned to that category — not counting products in its subcategories, and not yet testable since no product-creation endpoint exists (#31).
- Each item's `parentCategory` is a raw id (or `null`) — this is a **flat array, not a nested tree**. Build the two-level hierarchy client-side by grouping on `parentCategory`.
- **No guaranteed order** — unlike the public list below, this endpoint doesn't sort. No `search` query param either (admin search lands in #34).

---

## `GET /api/admin/categories/:id`

Fetches a single category by id, any status.

| Field  | Value                                              |
| ------ | ------------------------------------------------------ |
| Method | `GET`                                                  |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}`    |
| Name   | `Get Category (Admin)`                                 |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`.

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

Deletes a category — but only if it has **zero** products directly assigned to it **and** zero subcategories (`FR-CAT-019`). There's no product-creation endpoint yet (#31), so only the subcategory half of this guard is currently reproducible in Postman.

| Field  | Value                                              |
| ------ | ------------------------------------------------------ |
| Method | `DELETE`                                               |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}`    |
| Name   | `Delete Category`                                      |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

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

**Category has both products and subcategories** — the message names both, in one response (not reproducible today without products, listed for completeness):

```json
{
  "success": false,
  "code": "CATEGORY_IN_USE",
  "message": "Cannot delete category: referenced by 2 product(s) and 1 subcategory(ies)."
}
```

---

## `GET /api/categories`

Public, buyer-facing category list — active categories only, ordered, display fields only. No `X-Admin-Key` needed.

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
- Only `status: true` categories are returned — there's no status-toggle endpoint yet (#33), so every category stays active until one exists.
- **`metaTitle`/`metaDescription` are always present here**, unlike the admin endpoints — this is the one place the SEO fallback (`FR-CAT-022`) is actually applied:
  - `metaTitle` falls back to `name` when unset.
  - `metaDescription` falls back to a 160-character, word-boundary-safe truncation of `description` when unset; if there's no `description` either, it falls back to `name`.
- `status`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` are stripped entirely.
- `image` is included only when the category has one.
- No auth header required.

---

## Error Code Reference

Category-specific codes, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`, `OBJECT_KEY_NOT_ISSUED`) and [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                       | Status | Where it comes from                                                                                  | Reachable via an existing endpoint?                          |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `CATEGORY_NOT_FOUND`         | 404    | `categories.service.ts` — `GET`/`PATCH` by an id with no matching category                             | Yes                                                            |
| `INVALID_PARENT_CATEGORY`    | 400    | `categories.service.ts`'s `validateParentCategory()` — `parentCategory` set to the category's own id   | Yes (on `PATCH` only — create can't self-reference, no id yet) |
| `PARENT_CATEGORY_NOT_FOUND`  | 404    | same — the referenced `parentCategory` doesn't exist                                                    | Yes                                                            |
| `PARENT_CATEGORY_TOO_DEEP`   | 400    | same — the referenced `parentCategory` already has a parent of its own                                 | Yes                                                            |
| `CATEGORY_HAS_SUBCATEGORIES` | 400    | same — update-only: this category already has children and can't also be given a parent                | Yes                                                            |
| `CATEGORY_IN_USE`            | 409    | `categories.service.ts`'s `deleteCategory()` — referenced by ≥1 product and/or ≥1 subcategory           | Subcategory case yes; product case not yet (no product endpoint, #31) |

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For categories, the fields that can appear as keys are `name`, `description`, `parentCategory`, `image.objectKey`, `image.alt`, `sortOrder`, `metaTitle`, and `metaDescription`.

---

## What's Not Here Yet

This document is a snapshot of Issue #28 — not the full Product Catalog API. Category-governed specifications (`#29`) is now covered in [`categorySpecifications.api.md`](./categorySpecifications.api.md), including the specification half of `DELETE`'s cascade clause. Not yet implemented, each its own future issue:

- Category-governed variant types (`#30`) — the variant-type half of `DELETE`'s cascade clause waits on this
- Product core CRUD (`#31`) and product variants (`#32`)
- Status update APIs, including `PATCH /api/admin/categories/:id/status` (`#33`)
- Admin search, including `search` on `GET /api/admin/categories` (`#34`)
- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
