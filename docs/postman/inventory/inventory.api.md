# Postman Manual — TechCart Backend API (Inventory)

A step-by-step guide to testing per-warehouse stock rows in Postman.

**Scope:** this document covers the inventory half of the Inventory module (SRS v0.10, Issue #189): one row per `(product variant, warehouse)` pair, tracking a plain stock count. Mounted at `/api/admin/inventory`, gated `rbac(["catalog-manager","super-admin"])`. Every row is backfilled automatically the moment a new variant or a new warehouse is created — there's no manual "create an inventory row" endpoint at all, only list and stock-adjust. See [`warehouses.api.md`](./warehouses.api.md) for creating the warehouses these rows reference, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Inventory section for full implementation detail.

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running, `backend/.env` filled in, and an `admin_access_token` collection variable from [`../authentication/auth.api.md`](../authentication/auth.api.md#admin-sign-in-password--mandatory-otp)'s admin sign-in, as a `catalog-manager` or `super-admin`.

At least one warehouse (see [`warehouses.api.md`](./warehouses.api.md)) and one product with a variant (see [`../product-catalog/products.api.md`](../product-catalog/products.api.md)) — every combination of the two gets a row automatically. Paste an inventory row's `_id` into an `inventory_id` collection variable once you've listed one.

---

## `GET /api/admin/inventory`

Lists inventory rows, paginated, filterable by warehouse and keyword.

| Field  | Value                                |
| ------ | --------------------------------------- |
| Method | `GET`                                 |
| URL    | `{{base_url}}/api/admin/inventory`    |
| Name   | `List Inventory`                      |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param         | Values                              | Default |
| ------------- | ------------------------------------ | ------- |
| `page`        | integer ≥ 1                         | `1`     |
| `limit`       | integer 1–100                       | `20`    |
| `warehouseId` | a warehouse `_id` — exact match     | omitted |
| `search`      | free text — see below               | omitted |

Try: `{{base_url}}/api/admin/inventory?warehouseId={{warehouse_id}}&search=nova`

- **`search` matches at the product level** — a case-insensitive partial match against the product's `name` **or** any of its variant `sku`s. Matching either one pulls in **every** inventory row for that product across every variant, not just the row for the specific variant whose SKU matched — a deliberate simplification given how small this table is expected to stay.
- `warehouseId` and `search` compose independently, same as elsewhere in this API.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
      "productId": "66a4f1c8e3b7a91d2c8f4e01",
      "productName": "Nova X5 Pro 5G",
      "variantId": "66a4f1c8e3b7a91d2c8f4f01",
      "variantSku": "NOVA-X5P-128-BLK",
      "warehouseId": "66e1a2b3c4d5e6f7a8b9c0d1",
      "warehouseName": "Mumbai Warehouse",
      "stock": 7
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false }
}
```

- `productName`/`variantSku`/`warehouseName` are resolved/enriched server-side from their ids — you never need a separate lookup to make sense of a row. If a reference is somehow missing, the fallback is `"Unknown product"` / `"Unknown SKU"` / `"Unknown warehouse"` rather than a broken response.
- Sorted by `productId` — not alphabetically by name, and not by stock level.

### Error cases

**Malformed `warehouseId`:** `400 INVALID_ID`.

**Out-of-range `page`/`limit`:** `400 VALIDATION_ERROR`, same shape as the admin product list's own pagination errors.

Same `UNAUTHENTICATED`/`403 FORBIDDEN` shapes as [`warehouses.api.md`](./warehouses.api.md#post-apiadminwarehouses).

---

## `PATCH /api/admin/inventory/:inventoryId`

Sets one row's stock count directly — the only way to change stock through this API (buyer checkout/cart activity decrements it internally, but there's no other admin write path).

| Field  | Value                                                     |
| ------ | ------------------------------------------------------------ |
| Method | `PATCH`                                                     |
| URL    | `{{base_url}}/api/admin/inventory/{{inventory_id}}`         |
| Name   | `Update Inventory Stock`                                    |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "stock": 20 }
```

- `stock` — required integer. Sets the row's stock to this exact value (not a delta).

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
    "productId": "66a4f1c8e3b7a91d2c8f4e01",
    "variantId": "66a4f1c8e3b7a91d2c8f4f01",
    "warehouseId": "66e1a2b3c4d5e6f7a8b9c0d1",
    "stock": 20
  }
}
```

### Error cases

**Negative `stock`** — note this is a deliberate **service-level** check, not a Zod schema rule (Zod itself accepts any integer, positive or negative), specifically so the response carries this named error code rather than a generic `VALIDATION_ERROR`:

```
400 Bad Request
```

```json
{ "success": false, "code": "NEGATIVE_STOCK_REJECTED", "message": "Stock cannot be set to a negative value." }
```

**`:inventoryId` doesn't match any row:**

```
404 Not Found
```

```json
{ "success": false, "code": "INVENTORY_ROW_NOT_FOUND", "message": "Inventory record not found." }
```

**Non-integer `stock` (missing, wrong type):** `400 VALIDATION_ERROR`.

**Malformed `:inventoryId`:** `400 INVALID_ID`.

Same `UNAUTHENTICATED`/`403 FORBIDDEN` shapes as `GET` above.

---

## Error Code Reference

Inventory-specific codes, in addition to the ones already documented in [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`), [`../product-catalog/brands.api.md`](../product-catalog/brands.api.md#error-code-reference) (`INVALID_ID`), and [`warehouses.api.md`](./warehouses.api.md#error-code-reference):

| Code                       | Status | Where it comes from                                                        | Reachable via an existing endpoint? |
| --------------------------- | ------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| `NEGATIVE_STOCK_REJECTED`   | 400    | `inventory.service.ts`'s `updateStock` — the submitted `stock` value is negative | Yes                                     |
| `INVENTORY_ROW_NOT_FOUND`   | 404    | `inventory.service.ts`'s `updateStock` — `:inventoryId` matches no row          | Yes                                     |

---

## What's Not Here Yet

There's no bulk stock import/adjustment endpoint (one row at a time only), and stock is never split-visible by warehouse to a buyer — the buyer-facing surface only ever sees a 2-state `in_stock`/`out_of_stock` summary (see [`../product-catalog/products.api.md`](../product-catalog/products.api.md)'s `availability` field), never a warehouse or a raw count. Cart-time stock allocation (which warehouse a cart line actually reserves from) is entirely internal — see [`../shopping-cart/cart.api.md`](../shopping-cart/cart.api.md)'s `409 INSUFFICIENT_STOCK` error case.
