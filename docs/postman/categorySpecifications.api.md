# Postman Manual — TechCart Backend API (Category Specifications)

A step-by-step guide to testing the Category Specifications endpoints in Postman.

**Scope:** this document covers what's implemented as of Issue #29 (M2.5 — Category-governed specifications, `FR-CAT-030`–`035`): the three admin endpoints under `/api/admin/categories/:id/specifications`. Unlike brands/categories, this resource has **no public endpoint at all** — it's a schema-definition tool for admins, not something buyers ever read directly. It's also **no** status-toggle and **no** search, same deferral pattern as brands/categories (there's nothing here for `#33`/`#34` to defer, since this resource has neither `status` nor a list view). See [`uploads.api.md`](./uploads.api.md) for `GET /health`, the R2 upload endpoints, and the one-time Postman collection setup; see [`categories.api.md`](./categories.api.md) for the parent resource this hangs off of; see [`categoryVariants.api.md`](./categoryVariants.api.md) for the sibling resource with the identical `GET`/`PUT`/`PATCH`-only shape, minus the in-use delete guard this one has. This doc assumes collection setup is already done and reuses the same collection.

---

## Prerequisites

Same as [`uploads.api.md`](./uploads.api.md#prerequisites): backend running (`npm run dev --workspace backend`), `backend/.env` filled in, `admin_api_key` collection variable set.

**Required collection variable:** add `category_id` (or reuse the one from [`categories.api.md`](./categories.api.md#prerequisites)) — every request here is scoped to an existing category via `:id` in the URL. Create a category first via `POST /api/admin/categories` if you don't already have one.

---

## `GET /api/admin/categories/:id/specifications`

Reads a category's current specification schema.

| Field  | Value                                                        |
| ------ | -------------------------------------------------------------- |
| Method | `GET`                                                          |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/specifications` |
| Name   | `Get Category Specifications`                                  |

**Headers tab:** `X-Admin-Key: {{admin_api_key}}`. No body.

**Click Send. Expected response — `200 OK`** (before any schema has been defined):

```json
{
  "success": true,
  "data": {
    "category": "66a1f0c9e4b0a1a2b3c4d5e6",
    "specificationGroups": []
  }
}
```

- **No `404` when nothing's been defined yet** — the `:id` in the URL is a *category* id (already validated to exist); an empty `specificationGroups` array means "no schema defined," not "not found." Define one with `PUT` below to see a populated response.
- **No `_id`/`createdAt`/`updatedAt`** on this response, unlike every other admin `GET` in this API (brands/categories return the full record) — a deliberate choice for this schema-editor-shaped resource, since those fields aren't meaningful before a document exists and this endpoint keeps the same shape whether one does or not.

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

## `PUT /api/admin/categories/:id/specifications`

Defines or fully replaces the schema — every group and field, in one request, in the exact order you send them.

| Field  | Value                                                        |
| ------ | -------------------------------------------------------------- |
| Method | `PUT`                                                          |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/specifications` |
| Name   | `Define Category Specifications`                                |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "specificationGroups": [
    {
      "groupName": "Display",
      "specifications": [
        { "name": "Screen Size", "type": "number", "unit": "inches", "required": true, "filterable": true },
        { "name": "Resolution", "type": "text", "required": false, "filterable": false },
        { "name": "Panel Type", "type": "enum", "options": ["LCD", "OLED", "AMOLED"], "required": false, "filterable": true },
        { "name": "Touchscreen", "type": "boolean", "required": false, "filterable": true }
      ]
    }
  ]
}
```

**Click Send. Expected response — `200 OK`:** the schema you sent, echoed back (same shape as the `GET` response above).

- **Field declaration order is preserved** — it's significant downstream: it decides which fields reach a buyer product card when more than four are `filterable` (`FR-CAT-092`).
- `type` — one of `"text"`, `"number"`, `"boolean"`, `"enum"`.
- `options` — **required** when `type` is `"enum"`, ignored (but not rejected) otherwise.
- `filterable` — allowed on `"enum"`, `"boolean"`, and `"number"` fields; **rejected on `"text"`** — free text can't produce a usable buyer facet or a scannable card value (`FR-CAT-035`). See the error case below.
- `unit` — optional, freeform (e.g. `"inches"`, `"mAh"`, `"GB"`).
- **No duplicate `groupName`s across the payload, no duplicate field `name`s within a group** — beyond the SRS's literal text, but necessary so `FR-CAT-031`'s "matched on groupName + name" delete guard has an unambiguous target.
- This is a **full replace** — omitting a group or field that existed before removes it (no guard runs here; the guard only applies to `PATCH`'s targeted delete operations below). Running this twice with different payloads is how you edit an existing schema from scratch.

### Error cases

**Missing `X-Admin-Key` header:** `401 UNAUTHORIZED`, same shape as every other admin endpoint.

**`filterable: true` on a `"text"` field:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "filterable": "\"filterable\" cannot be true when type is \"text\"."
  }
}
```

**`type: "enum"` with no `options`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "options": "\"options\" is required when type is \"enum\"."
  }
}
```

**Duplicate `groupName` in the payload:**

```json
{
  "success": false,
  "code": "DUPLICATE_SPECIFICATION_GROUP",
  "message": "A group named \"Display\" already exists."
}
```

**Duplicate field `name` within one group:**

```json
{
  "success": false,
  "code": "DUPLICATE_SPECIFICATION_FIELD",
  "message": "A field named \"Screen Size\" already exists in group \"Display\"."
}
```

**Category doesn't exist:** same `CATEGORY_NOT_FOUND` shape as `GET`.

---

## `PATCH /api/admin/categories/:id/specifications`

Targeted updates — rename or delete a group, replace or delete a single field — without resending the whole schema. Send exactly **one** operation per request, distinguished by the `op` field.

| Field  | Value                                                        |
| ------ | -------------------------------------------------------------- |
| Method | `PATCH`                                                        |
| URL    | `{{base_url}}/api/admin/categories/{{category_id}}/specifications` |
| Name   | `Update Category Specifications`                                |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

`PATCH` only ever targets a group/field that **already exists** — there's no "create" operation here; add new groups/fields via `PUT` above (`FR-CAT-031`'s verbs are "update or delete," never "create").

### `renameGroup`

```json
{ "op": "renameGroup", "groupName": "Display", "newGroupName": "Screen" }
```

Renames the group in place; its fields are untouched. Rejected if `newGroupName` collides with another existing group.

### `deleteGroup`

```json
{ "op": "deleteGroup", "groupName": "Display" }
```

Removes the group and everything in it. **Guarded the same way `deleteField` is** — if *any* field in the group is currently referenced by a product's stored specifications, the whole group deletion is rejected, naming every blocking field (see error case below). This isn't explicitly spelled out in `FR-CAT-031` (which only names field-level deletion), but silently letting a group delete orphan referenced product data would be a worse failure mode than an extra confirmation step.

### `updateField`

```json
{
  "op": "updateField",
  "groupName": "Display",
  "name": "Screen Size",
  "field": { "name": "Screen Size", "type": "number", "unit": "in", "required": true, "filterable": true }
}
```

Replaces the named field with the given field object (same shape and same `filterable`/`options` rules as `PUT`). `field.name` can differ from `name` to rename it — rejected if the new name collides with another field already in the group.

### `deleteField`

```json
{ "op": "deleteField", "groupName": "Display", "name": "Resolution" }
```

Removes the field. **Guarded** — rejected if any product references it (see below).

**Click Send. Expected response — `200 OK`:** the full updated schema, same shape as `GET`/`PUT`.

### Error cases

**Group or field doesn't exist** (any operation referencing a `groupName`/`name` that isn't in the current schema):

```
404 Not Found
```

```json
{
  "success": false,
  "code": "SPECIFICATION_GROUP_NOT_FOUND",
  "message": "Specification group \"Dimensions\" was not found."
}
```

```json
{
  "success": false,
  "code": "SPECIFICATION_FIELD_NOT_FOUND",
  "message": "Specification field \"Weight\" was not found in group \"Display\"."
}
```

**Renaming a group or field to a name that already exists:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "DUPLICATE_SPECIFICATION_GROUP",
  "message": "A group named \"Screen\" already exists."
}
```

**Deleting a field currently referenced by a product** (create a product against this category via [`products.api.md`](./products.api.md) (`#31`) that supplies this field in its `specifications`, then retry the delete):

```
409 Conflict
```

```json
{
  "success": false,
  "code": "SPECIFICATION_FIELD_IN_USE",
  "message": "Cannot delete field \"Screen Size\": referenced by 2 product(s)."
}
```

**Deleting a group where one or more of its fields are referenced** — the message names every blocking field, not just the first:

```json
{
  "success": false,
  "code": "SPECIFICATION_FIELD_IN_USE",
  "message": "Cannot delete group \"Display\": \"Screen Size\" referenced by 2 product(s), \"Resolution\" referenced by 1 product(s)."
}
```

**Malformed or unrecognized `op`:**

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "op": "Invalid discriminator value. Expected 'renameGroup' | 'deleteGroup' | 'updateField' | 'deleteField'"
  }
}
```

**Category doesn't exist:** same `CATEGORY_NOT_FOUND` shape as `GET`.

---

## Error Code Reference

Codes specific to this resource, in addition to the ones already documented in [`uploads.api.md`](./uploads.api.md#error-code-reference) (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`) and [`brands.api.md`](./brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                          | Status | Where it comes from                                                                        | Reachable via an existing endpoint?                    |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `CATEGORY_NOT_FOUND`            | 404    | `categorySpecifications.service.ts` — `:id` doesn't match any category                        | Yes                                                       |
| `SPECIFICATION_GROUP_NOT_FOUND` | 404    | same — a `PATCH` operation names a `groupName` that doesn't exist                              | Yes                                                       |
| `SPECIFICATION_FIELD_NOT_FOUND` | 404    | same — `updateField`/`deleteField` names a field that doesn't exist in that group              | Yes                                                       |
| `DUPLICATE_SPECIFICATION_GROUP` | 400    | same — `PUT` payload has a repeated `groupName`, or `renameGroup`/`updateField` collides       | Yes                                                       |
| `DUPLICATE_SPECIFICATION_FIELD` | 400    | same — `PUT` payload has a repeated field `name` within one group, or `updateField` collides   | Yes                                                       |
| `SPECIFICATION_FIELD_IN_USE`    | 409    | same — `deleteField`/`deleteGroup` blocked by ≥1 product referencing a field                   | Yes — see [`products.api.md`](./products.api.md) (#31) |

---

## Understanding Validation Errors

Same `errors`-object shape as [`uploads.api.md`](./uploads.api.md#understanding-validation-errors). For this resource, the fields that can appear as keys include `specificationGroups`, `groupName`, `specifications`, `name`, `type`, `unit`, `options`, `required`, `filterable`, and — for `PATCH` — `op`, `newGroupName`, `field`.

---

## What's Not Here Yet

This document is a snapshot of Issue #29 — not the full Product Catalog API. Category-governed variant types (`#30`), the sibling resource to this one, is now covered in [`categoryVariants.api.md`](./categoryVariants.api.md), and product core CRUD (`#31`) — the actual consumer of this schema (`FR-CAT-032`) — plus product variants (`#32`, which carry no `specifications` of their own, so this schema doesn't apply to them) in [`products.api.md`](./products.api.md). Not yet implemented, each its own future issue:

- Status update APIs (`#33`) and admin search (`#34`) — not applicable to this resource at all (no `status`, no list view)
- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`) — this is where `filterable` fields actually become buyer-facing facets and card content

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
