# Postman Manual — TechCart Backend API (Warehouses)

A step-by-step guide to testing warehouse creation and listing in Postman.

**Scope:** this document covers the warehouses half of the Inventory module (SRS v0.10, Issue #189): a small, fixed set of 2–3 warehouses that per-variant stock is tracked against. Mounted at `/api/admin/warehouses`, gated `rbac(["catalog-manager","super-admin"])`. See [`inventory.api.md`](./inventory.api.md) for the stock rows themselves, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Inventory section for full implementation detail.

**Create + list only — deliberately no edit/delete/status-toggle endpoint exists at all.** Unlike every other admin entity in this API (brands, categories, products), a warehouse can't be renamed, deactivated, or removed once created. This matches this codebase's existing precedent of an entity with a deliberately narrow surface — see [`../product-catalog/categoryVariants.api.md`](../product-catalog/categoryVariants.api.md)'s own "no in-use delete guard" for a similar documented, intentional gap elsewhere in this API.

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running, `backend/.env` filled in, and an `admin_access_token` collection variable from [`../authentication/auth.api.md`](../authentication/auth.api.md#admin-sign-in-password--mandatory-otp)'s admin sign-in, as a `catalog-manager` or `super-admin`.

**Optional collection variable:** add `warehouse_id` (leave empty) to paste a created warehouse's `_id` into for reuse in [`inventory.api.md`](./inventory.api.md).

---

## `POST /api/admin/warehouses`

Creates a new warehouse.

| Field  | Value                                |
| ------ | --------------------------------------- |
| Method | `POST`                                |
| URL    | `{{base_url}}/api/admin/warehouses`   |
| Name   | `Create Warehouse`                    |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "name": "Mumbai Warehouse", "code": "MUM" }
```

- `name` — required, non-empty string.
- `code` — required, non-empty string, **unique** across every warehouse. There's no format requirement beyond non-empty — `"MUM"`/`"mumbai-01"`/anything works, as long as it's not already taken.
- No `active` field is accepted here — every warehouse is created active, and there's no way to deactivate one via this API (see the scope note above).

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "_id": "66e1a2b3c4d5e6f7a8b9c0d1",
    "name": "Mumbai Warehouse",
    "code": "MUM",
    "active": true,
    "createdAt": "2026-08-30T10:00:00.000Z"
  }
}
```

- No `updatedAt` on this model — warehouses never get updated after creation.
- **Side effect**: creating a warehouse immediately backfills a `stock: 0` inventory row for **every existing (product, variant) pair, across every product in the catalog**, at this new warehouse — so a newly-created warehouse shows up right away in [`inventory.api.md`](./inventory.api.md)'s list, at zero stock for everything. On a catalog with many products/variants this can take a moment.
- Paste the returned `_id` into a `warehouse_id` collection variable to use in [`inventory.api.md`](./inventory.api.md)'s `?warehouseId=` filter.

### Error cases

**Missing `name`/`code`:**

```
400 Bad Request
```

```json
{ "success": false, "code": "VALIDATION_ERROR", "errors": { "code": "Too small: expected string to have >=1 characters" } }
```

**`code` already in use by another warehouse:**

```
400 Bad Request
```

```json
{ "success": false, "code": "DUPLICATE_WAREHOUSE_CODE", "message": "Code \"MUM\" is already in use." }
```

**A `catalog-manager`-excluding session (e.g. `order-manager`):**

```
403 Forbidden
```

```json
{ "success": false, "code": "FORBIDDEN", "message": "This action requires one of: catalog-manager, super-admin." }
```

Same `UNAUTHENTICATED` shape as every other admin endpoint.

---

## `GET /api/admin/warehouses`

Lists every warehouse.

| Field  | Value                                |
| ------ | --------------------------------------- |
| Method | `GET`                                 |
| URL    | `{{base_url}}/api/admin/warehouses`   |
| Name   | `List Warehouses`                     |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**No query params — no pagination, no search, no filter of any kind.** With only 2–3 warehouses expected to ever exist, this is a plain, full, unpaginated array.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    { "_id": "66e1a2b3c4d5e6f7a8b9c0d1", "name": "Mumbai Warehouse", "code": "MUM", "active": true, "createdAt": "2026-08-30T10:00:00.000Z" },
    { "_id": "66e1a2b3c4d5e6f7a8b9c0d2", "name": "Delhi Warehouse", "code": "DEL", "active": true, "createdAt": "2026-08-30T10:05:00.000Z" }
  ]
}
```

- Sorted `createdAt` ascending (creation order).
- **No `pagination` key at all** on this response — unlike the paginated admin lists elsewhere in this API (brands/categories/products/inventory).

### Error cases

Same `UNAUTHENTICATED`/`403 FORBIDDEN` shapes as `POST` above.

---

## Error Code Reference

Warehouse-specific codes, in addition to the ones already documented in [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`):

| Code                       | Status | Where it comes from                                                     | Reachable via an existing endpoint? |
| --------------------------- | ------ | ---------------------------------------------------------------------------- | -------------------------------------- |
| `DUPLICATE_WAREHOUSE_CODE`  | 400    | `warehouses.service.ts`'s `createWarehouse` — the submitted `code` already exists | Yes                                     |

---

## What's Not Here Yet

No edit, delete, deactivate, or status-toggle endpoint exists for a warehouse, by design (see the scope note above) — a warehouse, once created, is permanent for the life of the system. See [`inventory.api.md`](./inventory.api.md) for reading/adjusting the actual per-variant stock rows this warehouse now owns.
