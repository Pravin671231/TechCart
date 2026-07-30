# Postman Manual — TechCart Backend API (Category Variant Types)

A step-by-step guide to testing the Category Variant Types endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #30 (M2.6 — Category-governed variant types, `FR-CAT-036`–`038`): the three admin endpoints under `/api/admin/categories/:id/variant-types`. Like its sibling resource, this has **no public endpoint at all** — it's a form-rendering guide for the admin product-variant editor, not something buyers ever read directly. Also **no** status-toggle and **no** search, same deferral pattern as brands/categories (nothing here for `#33`/`#34` to defer, since this resource has neither `status` nor a list view). See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup; see [`categories.api.md`](./categories.api.md) for the parent resource this hangs off of; see [`categorySpecifications.api.md`](./categorySpecifications.api.md) for the sibling resource this one is structurally closest to — same `GET`/`PUT`/`PATCH`-only shape, one deliberate divergence (no in-use delete guard, called out below). This doc assumes collection setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set.

**Required collection variable:** add `category_id` (or reuse the one from [`categories.api.md`](./categories.api.md#prerequisites)) — every request here is scoped to an existing category via `:id` in the URL. Create a category first via `POST /api/admin/categories` if you don't already have one.

---

## `GET /api/admin/categories/:id/variant-types`

Reads a category's currently defined variant axes.

| Field  | Value                                                             |
| ------ | ----------------------------------------------------------------- |
| Method | `GET`                                                             |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/variant-types` |
| Name   | `Get Category Variant Types`                                      |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Click Send. Expected response — `200 OK`** (before any axes have been defined):

```json
{
  "success": true,
  "data": {
    "category": "66a1f0c9e4b0a1a2b3c4d5e6",
    "variants": []
  }
}
```

- **No `404` when nothing's been defined yet** — same reasoning as `categorySpecifications`: the `:id` in the URL is a _category_ id (already validated to exist); an empty `variants` array means "no axes defined," not "not found." Define some with `PUT` below to see a populated response.
- **No `_id`/`createdAt`/`updatedAt`** on this response, same schema-editor-shaped deviation as `categorySpecifications`.

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

## `PUT /api/admin/categories/:id/variant-types`

Defines or fully replaces the axis list — every axis, in one request, in the exact order you send them.

| Field  | Value                                                             |
| ------ | ----------------------------------------------------------------- |
| Method | `PUT`                                                             |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/variant-types` |
| Name   | `Define Category Variant Types`                                   |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "variants": [
    {
      "name": "Color",
      "code": "color",
      "type": "color",
      "required": true,
      "options": [
        { "label": "Red", "value": "red" },
        { "label": "Blue", "value": "blue" }
      ]
    },
    {
      "name": "Size",
      "code": "size",
      "type": "select",
      "required": false,
      "options": [
        { "label": "Small", "value": "S" },
        { "label": "Large", "value": "L" }
      ]
    },
    { "name": "Material", "code": "material", "type": "text", "required": false }
  ]
}
```

**Click Send. Expected response — `200 OK`:** the axis list you sent, echoed back (same shape as the `GET` response above).

- **Declaration order is preserved** — it decides the order the admin variant editor renders controls in (`FR-CAT-038`).
- `type` — one of `"text"`, `"select"`, `"color"`, `"number"`; **defaults to `"select"`** when omitted (`FR-CAT-036`).
- `options` — array of `{label, value}` pairs. **Required** when `type` is `"select"` or `"color"`; **rejected** when `type` is `"text"` or `"number"` (a free-text or numeric input has nothing to pick from). See the error cases below.
- **No duplicate axis `code`s across the payload** — beyond the SRS's literal text, but necessary so `PATCH`'s `code`-matched operations below have an unambiguous target (mirrors `categorySpecifications`' duplicate-name guard on `PUT`).
- This is a **full replace** — omitting an axis that existed before removes it, unconditionally, with no guard at all (see the `PATCH`/`deleteAxis` note below for why). Running this twice with different payloads is how you edit the axis list from scratch.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint.

**`type: "select"` (or `"color"`) with no `options`:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "options": "\"options\" is required when type is \"select\" or \"color\"."
  }
}
```

**`type: "text"` (or `"number"`) with `options` attached:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "options": "\"options\" is not allowed when type is \"text\" or \"number\"."
  }
}
```

**Duplicate axis `code` in the payload:**

```json
{
  "success": false,
  "code": "DUPLICATE_VARIANT_AXIS",
  "message": "An axis with code \"color\" already exists."
}
```

**Category doesn't exist:** same `CATEGORY_NOT_FOUND` shape as `GET`.

---

## `PATCH /api/admin/categories/:id/variant-types`

Targeted updates — replace or delete a single axis — without resending the whole list. Send exactly **one** operation per request, distinguished by the `op` field.

| Field  | Value                                                             |
| ------ | ----------------------------------------------------------------- |
| Method | `PATCH`                                                           |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/variant-types` |
| Name   | `Update Category Variant Types`                                   |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

`PATCH` only ever targets an axis that **already exists** — there's no "create" operation here; add new axes via `PUT` above (`FR-CAT-037`'s verbs are "update or delete," never "create"). Both operations match on `code`, not `name` — see the note under `updateAxis` for why.

### `updateAxis`

```json
{
  "op": "updateAxis",
  "code": "color",
  "axis": {
    "name": "Colour",
    "code": "color",
    "type": "color",
    "required": true,
    "options": [
      { "label": "Red", "value": "red" },
      { "label": "Blue", "value": "blue" },
      { "label": "Green", "value": "green" }
    ]
  }
}
```

Replaces the axis matched by the top-level `code` with the given axis object (same shape and same `options` rules as `PUT`). The nested `axis.code` can differ from the top-level `code` to rename it — rejected if the new code collides with another axis already in the list. Renaming is safe to do freely here, unlike `categorySpecifications`' field rename: `FR-CAT-037` guarantees this definition is never enforced against stored variant attributes, so there's nothing downstream a rename could orphan.

### `deleteAxis`

```json
{ "op": "deleteAxis", "code": "material" }
```

Removes the axis. **Unconditional — no guard at all**, even if products currently hold variants using that axis (`FR-CAT-037`). This is the one deliberate divergence from `categorySpecifications`' `deleteField`/`deleteGroup`, which reject when a product references the target. Deleting an axis here just means the admin variant editor falls back to a plain text input for that attribute going forward — nothing about existing product variant data changes.

**Click Send. Expected response — `200 OK`:** the full updated axis list, same shape as `GET`/`PUT`.

### Error cases

**Axis doesn't exist** (either operation naming a `code` that isn't in the current list):

```
404 Not Found
```

```json
{
  "success": false,
  "code": "VARIANT_AXIS_NOT_FOUND",
  "message": "Variant axis \"weight\" was not found."
}
```

**Renaming (recoding) an axis to a code that already exists:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "DUPLICATE_VARIANT_AXIS",
  "message": "An axis with code \"size\" already exists."
}
```

**Malformed or unrecognized `op`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "op": "Invalid discriminator value. Expected 'updateAxis' | 'deleteAxis'"
  }
}
```

**Category doesn't exist:** same `CATEGORY_NOT_FOUND` shape as `GET`.

---

## Error Code Reference

Codes specific to this resource, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`) and [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                     | Status | Where it comes from                                                                       | Reachable via an existing endpoint? |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| `CATEGORY_NOT_FOUND`     | 404    | `categoryVariants.service.ts` — `:id` doesn't match any category                          | Yes                                 |
| `VARIANT_AXIS_NOT_FOUND` | 404    | same — `updateAxis`/`deleteAxis` names a `code` that doesn't exist                        | Yes                                 |
| `DUPLICATE_VARIANT_AXIS` | 400    | same — `PUT` payload has a repeated axis `code`, or `updateAxis` recodes into a collision | Yes                                 |

Notably absent: there is **no** `VARIANT_AXIS_IN_USE`-style code — unlike `categorySpecifications`' `SPECIFICATION_FIELD_IN_USE`, this resource has no in-use guard for `PATCH`/`deleteAxis` to produce one (`FR-CAT-037`).

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For this resource, the fields that can appear as keys include `variants`, `name`, `code`, `type`, `required`, `options`, and — for `PATCH` — `op`, `axis`.

---

## What's Not Here Yet

This document is a snapshot of Issue #30 — not the full Product Catalog API. Not yet implemented, each its own future issue:

- Product core CRUD (`#31`) and product variants (`#32`) — the actual consumer of this axis list on the admin side (`FR-CAT-038`'s per-axis control rendering doesn't exist yet); unlike `categorySpecifications`, product variants are never validated _against_ this list at all (`FR-CAT-037`)
- Status update APIs (`#33`) and admin search (`#34`) — not applicable to this resource at all (no `status`, no list view)
- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
