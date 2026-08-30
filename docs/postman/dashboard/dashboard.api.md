# Postman Manual — TechCart Backend API (Admin Dashboard)

A step-by-step guide to testing the admin dashboard aggregation endpoints in Postman.

**Scope:** this document covers the dashboard module (SRS v0.7, Issues #171–#172): read-only aggregations over data already owned by `orders`/`payments`/`products`/`categories`/`brands` — no new primary collection, nothing here is ever written to directly. Mounted at `/api/admin/dashboard`. Three routes need `rbac(["order-manager","super-admin"])`; the fourth, `catalog-summary`, needs the **reciprocal** role pair, `rbac(["catalog-manager","super-admin"])` — this is a deliberate role split, not an oversight, and the two role groups are locked out of each other's routes (see error cases below). See [`../authentication/account.api.md#get-apiaccountdashboard`](../authentication/account.api.md#get-apiaccountdashboard) for the separate buyer-facing "my own account" dashboard, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Dashboard section for full implementation detail.

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running, `backend/.env` filled in, and an `admin_access_token` collection variable from [`../authentication/auth.api.md`](../authentication/auth.api.md#admin-sign-in-password--mandatory-otp)'s admin sign-in. `summary`/`sales`/`top-products` need an `order-manager` or `super-admin` session; `catalog-summary` needs a `catalog-manager` or `super-admin` session — sign in as whichever role you're testing (or `super-admin`, which passes both).

A few placed and paid orders (see [`../order-management/orders.api.md`](../order-management/orders.api.md) and [`../payments/payments.api.md`](../payments/payments.api.md)) make `summary`/`sales`/`top-products` show non-zero figures; some products/categories/brands in various statuses make `catalog-summary` interesting.

---

## `?from=` / `?to=` date range rules

Shared by `summary`, `sales`, and `top-products` (not `catalog-summary`, which is a live snapshot with no range concept):

| Param  | Format                                    | Default when omitted |
| ------ | ------------------------------------------ | ------------------------ |
| `from` | any string `new Date()` can parse (a plain date or full ISO datetime) | epoch (only meaningful if `to` is also omitted, since a range is then applied) |
| `to`   | same                                       | now                       |

- **Both omitted** → defaults to the **last 30 days**.
- **Either value fails to parse** (not a valid date at all):

  ```
  400 Bad Request
  ```

  ```json
  { "success": false, "code": "INVALID_DATE_RANGE", "message": "from/to must be valid dates." }
  ```

- **`to` earlier than `from`** — same code, different message:

  ```json
  { "success": false, "code": "INVALID_DATE_RANGE", "message": "to must not be before from." }
  ```

  Never silently swapped or clamped.

- **Range spans more than ~1 year** (366 days, to tolerate leap years):

  ```
  400 Bad Request
  ```

  ```json
  { "success": false, "code": "RANGE_TOO_LARGE", "message": "Date range must not exceed one year." }
  ```

**Bucketing** (`sales` only): a range of 31 days or less buckets by **day** (`YYYY-MM-DD` keys); anything longer buckets by **ISO week** (`YYYY-Www` keys, e.g. `2026-W05`). Every bucket key in the resolved range is generated up front and zero-filled — `series` never has a gap for a day/week with zero orders.

---

## Caching

Every one of the four endpoints below is cached for **60 seconds** (`getOrSetCache`, Redis-backed when `REDIS_URL` is set, an in-process fallback otherwise) — the cache key includes the resolved date range, so two different `?from=`/`?to=` combinations never collide. There's no manual cache-bust endpoint; if you change underlying data and want to see it reflected immediately, wait out the 60s window or restart the backend (which clears the in-process fallback).

---

## Money units

**Whole rupees** on every figure here — `totalRevenue`, `series[].revenue`, `products[].revenue`. The one conversion point is `payments`-sourced figures (captured amounts, refunds — stored in paise, the sole exception in this codebase): divided by 100 exactly once, at the aggregation boundary (`paiseToRupees`). Order-sourced figures (`orders.totalAmount`) need no conversion at all, since orders are already whole rupees.

---

## `GET /api/admin/dashboard/summary`

Net revenue and order counts for a date range.

| Field  | Value                                     |
| ------ | -------------------------------------------- |
| Method | `GET`                                       |
| URL    | `{{base_url}}/api/admin/dashboard/summary`  |
| Name   | `Dashboard Summary`                         |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (both optional, see date range rules above):** `from`, `to`.

Try: `{{base_url}}/api/admin/dashboard/summary?from=2026-01-01&to=2026-01-31`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-01-01T00:00:00.000Z", "to": "2026-01-31T23:59:59.999Z" },
    "totalOrders": 2,
    "totalRevenue": 40000,
    "ordersByStatus": { "paid": 2, "processing": 1 }
  }
}
```

- `totalRevenue` is **captured payments minus refunds processed in this same range**, net of both — not simply a sum of `orders.totalAmount` for orders placed in range.
- `ordersByStatus` only lists statuses that actually occurred at least once in range — a status with zero orders is omitted, not zero-valued.

### Error cases

**A `catalog-manager` session:**

```
403 Forbidden
```

```json
{ "success": false, "code": "FORBIDDEN", "message": "This action requires one of: order-manager, super-admin." }
```

Same `INVALID_DATE_RANGE`/`RANGE_TOO_LARGE` shapes as the date-range rules above. Same `UNAUTHENTICATED` shape as every other admin endpoint.

---

## `GET /api/admin/dashboard/sales`

Order volume and revenue bucketed over time — the data behind a revenue chart.

| Field  | Value                                   |
| ------ | ------------------------------------------ |
| Method | `GET`                                     |
| URL    | `{{base_url}}/api/admin/dashboard/sales`  |
| Name   | `Sales Over Time`                         |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params:** `from`, `to` (same rules as above).

Try: `{{base_url}}/api/admin/dashboard/sales?from=2026-01-01&to=2026-01-05`

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-01-01T00:00:00.000Z", "to": "2026-01-05T00:00:00.000Z" },
    "bucket": "day",
    "series": [
      { "date": "2026-01-01", "revenue": 0, "orders": 0 },
      { "date": "2026-01-02", "revenue": 0, "orders": 0 },
      { "date": "2026-01-03", "revenue": 15000, "orders": 1 },
      { "date": "2026-01-04", "revenue": 0, "orders": 0 },
      { "date": "2026-01-05", "revenue": 25000, "orders": 1 }
    ]
  }
}
```

- Bucketed by each order's own `createdAt` — **not** `payments.capturedAt` — a distinct, order-volume view from `summary`'s net-revenue figure above.
- `series` is always fully zero-filled across the resolved range, regardless of how sparse the actual data is.

### Error cases

Same as `summary` above.

---

## `GET /api/admin/dashboard/top-products`

The top 10 products by revenue in a date range.

| Field  | Value                                          |
| ------ | -------------------------------------------------- |
| Method | `GET`                                             |
| URL    | `{{base_url}}/api/admin/dashboard/top-products`   |
| Name   | `Top Products`                                    |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params:** `from`, `to` (same rules as above).

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-01-01T00:00:00.000Z", "to": "2026-01-31T23:59:59.999Z" },
    "products": [
      { "productId": "66a4f1c8e3b7a91d2c8f4e01", "name": "Nova X5 Pro 5G", "slug": "nova-x5-pro-5g", "unitsSold": 3, "revenue": 120000 },
      { "productId": "66a4f1c8e3b7a91d2c8f4e02", "name": "Orbit Buds", "slug": "orbit-buds", "unitsSold": 5, "revenue": 25000 }
    ]
  }
}
```

- Fixed at **10** results max, sorted by revenue descending, ties broken by units sold.
- Sourced entirely from each order's own frozen `OrderItemSnapshot` — a renamed/deleted product still shows up here under the name it had at order time.

### Error cases

Same as `summary` above.

---

## `GET /api/admin/dashboard/catalog-summary`

A live catalog-health snapshot — product/category/brand status counts, no date range.

| Field  | Value                                              |
| ------ | ------------------------------------------------------ |
| Method | `GET`                                                 |
| URL    | `{{base_url}}/api/admin/dashboard/catalog-summary`    |
| Name   | `Catalog Summary`                                     |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}` — as a `catalog-manager` or `super-admin` (**not** `order-manager` — see error case below). No body, no query params.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "totalProducts": 4,
    "productsByStatus": { "draft": 1, "published": 2, "archived": 1 },
    "totalCategories": 2,
    "activeCategories": 1,
    "totalBrands": 1,
    "activeBrands": 1
  }
}
```

- **There is no `outOfStockCount` field anywhere in this response** — a deliberate scope boundary. Even though Inventory (SRS v0.10) now exists and could compute one, this endpoint was never revisited to add it.

### Error cases

**An `order-manager` session** (the reciprocal of `summary`/`sales`/`top-products`'s own restriction):

```
403 Forbidden
```

```json
{ "success": false, "code": "FORBIDDEN", "message": "This action requires one of: catalog-manager, super-admin." }
```

Same `UNAUTHENTICATED` shape as every other admin endpoint.

---

## Error Code Reference

| Code                 | Status | Where it comes from                                                                    | Reachable via an existing endpoint? |
| --------------------- | ------ | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| `INVALID_DATE_RANGE`  | 400    | `src/utils/dateRange.ts`'s `resolveDateRange` — an unparseable `from`/`to`, or `to` before `from` | Yes                                     |
| `RANGE_TOO_LARGE`     | 400    | `src/utils/dateRange.ts` — the resolved range exceeds ~366 days                            | Yes                                     |
| `FORBIDDEN`           | 403    | `src/middleware/rbac.ts` — wrong admin role for the specific route (two reciprocal groups) | Yes                                     |
| `UNAUTHENTICATED`     | 401    | no/invalid session                                                                          | Yes                                     |

---

## What's Not Here Yet

There's no per-day/per-product export (CSV/PDF) of any of this data — every response is JSON only. `catalog-summary` has no `outOfStockCount` (see above) despite Inventory now existing. See [`../authentication/account.api.md#get-apiaccountdashboard`](../authentication/account.api.md#get-apiaccountdashboard) for the separate, much narrower buyer-facing dashboard.
