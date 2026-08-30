# Postman Manual — TechCart Backend API (Orders — Admin)

A step-by-step guide to testing admin order management in Postman.

**Scope:** this document covers the admin-facing half of the Orders module (SRS v0.5, Issue #158): the full order list across every buyer, order detail, status advancement through the order lifecycle, and admin-initiated cancellation. Every route is gated `rbac(ORDER_ADMIN_ROLES)` — `["order-manager", "super-admin"]` (`src/middleware/rbac.ts`) — mounted at `/api/admin/orders`. A `catalog-manager` session is rejected on every route below. See [`orders.api.md`](./orders.api.md) for the buyer-facing checkout/history/cancel endpoints and the full [Order Status Lifecycle](./orders.api.md#order-status-lifecycle) table, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Orders section for full implementation detail.

**Related — Refunds:** `POST /api/admin/orders/:id/refund` is wired onto this exact router (it reuses this router's `ORDER_ADMIN_ROLES` guard) but is documented separately, since it belongs to the payments module:

| Method | Path                              | Purpose                          |
| ------ | ---------------------------------- | ----------------------------------- |
| `POST` | `/api/admin/orders/:id/refund`    | Full or partial refund of a payment |

Full request/response examples and error cases: see [`../payments/payments.api.md`](../payments/payments.api.md).

---

## Prerequisites

Same as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#prerequisites): backend running, `backend/.env` filled in, and an `admin_access_token` collection variable set from [`../authentication/auth.api.md`](../authentication/auth.api.md#admin-sign-in-password--mandatory-otp)'s admin sign-in (password + OTP), as an `order-manager` or `super-admin` — a `catalog-manager` session is rejected on every route in this file.

At least one placed order helps exercise these endpoints — check out from a buyer session first (see [`orders.api.md`](./orders.api.md#post-apiorders)) and copy its `_id` into an `order_id` collection variable.

---

## `GET /api/admin/orders`

Lists **every** buyer's orders, paginated, sortable, filterable by keyword and status.

| Field  | Value                            |
| ------ | ----------------------------------- |
| Method | `GET`                             |
| URL    | `{{base_url}}/api/admin/orders`   |
| Name   | `List Orders (Admin)`             |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Query params (all optional):**

| Param      | Values                                       | Default     |
| ---------- | --------------------------------------------- | ----------- |
| `page`     | integer ≥ 1                                  | `1`         |
| `limit`    | integer 1–100                                | `20`        |
| `sortBy`   | `createdAt` \| `totalAmount`                | `createdAt` |
| `orderBy`  | `asc` \| `desc` \| `none`                    | `none`      |
| `search`   | free text — matched against order number (partial, case-insensitive) **or** the buyer's email (partial, case-insensitive) | omitted |
| `status`   | any of the [Order Status Lifecycle](./orders.api.md#order-status-lifecycle) values | omitted |

Try: `{{base_url}}/api/admin/orders?search=TC-2026&status=paid&sortBy=totalAmount&orderBy=desc`

- `search` and `status` are **independent filters that compose** — matching the same pattern as the product-catalog admin lists (`search`/`status` on `GET /api/admin/products`, see [`../product-catalog/products.api.md`](../product-catalog/products.api.md)).

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "66d2b3c4d5e6f7a8b9c0d1e2",
      "orderNumber": "TC-2026-000001",
      "user": "66a1f0c9e4b0a1a2b3c4d5e6",
      "status": "paid",
      "items": [{ "...": "... same OrderItemSnapshot shape as orders.api.md ..." }],
      "shippingAddress": { "...": "..." },
      "totalAmount": 80000,
      "statusHistory": [{ "status": "pending_payment", "at": "..." }, { "status": "paid", "at": "..." }],
      "createdAt": "2026-08-30T10:00:00.000Z",
      "payment": { "status": "captured", "amount": 8000000, "razorpayPaymentId": "pay_..." }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false }
}
```

- Every item carries a `payment` summary (`{status, amount, razorpayPaymentId?} | null`), resolved in one batched query for the whole page — not a per-row lookup. `payment.amount` is paise, matching [`../payments/payments.api.md`](../payments/payments.api.md)'s convention; every other money field on this response is whole rupees.

### Error cases

**A `catalog-manager` session:**

```
403 Forbidden
```

```json
{
  "success": false,
  "code": "FORBIDDEN",
  "message": "This action requires one of: order-manager, super-admin."
}
```

**Out-of-range `page`/`limit`, or an unrecognized `sortBy`/`orderBy`/`status`:** `400 VALIDATION_ERROR`, same shape as the admin product list's own pagination/sort errors.

**No session at all:** `401 UNAUTHENTICATED`.

---

## `GET /api/admin/orders/:id`

Fetches any order by id — no ownership restriction, unlike the buyer-facing detail endpoint.

| Field  | Value                                          |
| ------ | ------------------------------------------------- |
| Method | `GET`                                            |
| URL    | `{{base_url}}/api/admin/orders/{{order_id}}`     |
| Name   | `Get Order (Admin)`                              |

**Headers tab:** `Authorization: Bearer {{admin_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "...": "... same OrderResponse fields as the list item above ...",
    "buyer": { "id": "66a1f0c9e4b0a1a2b3c4d5e6", "name": "Asha Rao", "email": "buyer@example.com" },
    "payment": { "status": "captured", "amount": 8000000, "razorpayPaymentId": "pay_..." }
  }
}
```

- `buyer` — `{id, name, email} | null`; `name` defaults to `""` if the underlying account somehow has none set. `null` only in the effectively-unreachable edge case where the ordering user no longer resolves at all.

### Error cases

**Nonexistent id:** `404 ORDER_NOT_FOUND` (no ownership check — any admin can look up any order).

**Malformed `:id`:** `400 INVALID_ID`.

**A `catalog-manager` session:** same `403 FORBIDDEN` shape as the list endpoint above.

---

## `PATCH /api/admin/orders/:id/status`

Advances an order through the [lifecycle](./orders.api.md#order-status-lifecycle) — the general-purpose status-change endpoint for every transition other than a cancel or a refund.

| Field  | Value                                                 |
| ------ | -------------------------------------------------------- |
| Method | `PATCH`                                                 |
| URL    | `{{base_url}}/api/admin/orders/{{order_id}}/status`     |
| Name   | `Update Order Status`                                   |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (example — moving a `paid` order into `processing`):

```json
{ "status": "processing" }
```

**Body tab → raw → JSON** (example — shipping it, with a tracking reference):

```json
{ "status": "shipped", "trackingReference": "SHIP-IN-2026-XYZ123" }
```

- `status` — required, one of the [Order Status Lifecycle](./orders.api.md#order-status-lifecycle) values. The move must be a legal edge in that table, or the request 409s (see below).
- `trackingReference` — optional string. **Persisted whenever you supply it, on any transition** — the backend doesn't restrict which status it can be attached to. Attaching it on the transition into `shipped` is an admin-UI convention, not a rule this endpoint itself enforces.

**Click Send. Expected response — `200 OK`:** the full updated order, `status` set to the new value, `trackingReference` present if you sent one, and a new entry appended to `statusHistory`.

- This is a general-purpose status setter — it is **not** how you cancel (`cancelled` is a legal `to` value from this endpoint too, but the dedicated `POST .../cancel` below is the intended path, since it also requires a `reason`) or refund (see [`../payments/payments.api.md`](../payments/payments.api.md), which has its own dedicated flow that also updates `payments.status`).

### Error cases

**Illegal transition** (e.g. `pending_payment` straight to `shipped`, or moving out of a terminal `cancelled`/`refunded` order):

```
409 Conflict
```

```json
{
  "success": false,
  "code": "INVALID_ORDER_TRANSITION",
  "message": "Cannot move an order from 'pending_payment' to 'shipped'."
}
```

**Unrecognized `status` value, or an empty `trackingReference` string:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": { "status": "Invalid option: expected one of \"pending_payment\"|\"paid\"|\"processing\"|\"shipped\"|\"delivered\"|\"cancelled\"|\"refunded\"" }
}
```

Same `ORDER_NOT_FOUND`/`INVALID_ID`/`403 FORBIDDEN` shapes as `GET :id` above.

---

## `POST /api/admin/orders/:id/cancel`

Admin-initiated cancellation — unlike the buyer's own self-cancel (see [`orders.api.md`](./orders.api.md#post-apiordersidcancel)), this **requires a reason**.

| Field  | Value                                          |
| ------ | ------------------------------------------------- |
| Method | `POST`                                           |
| URL    | `{{base_url}}/api/admin/orders/{{order_id}}/cancel` |
| Name   | `Cancel Order (Admin)`                           |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "reason": "Customer requested cancellation via support ticket #4821." }
```

- `reason` — **required**, minimum 1 character. Unlike the buyer's cancel, which needs no body at all.

**Click Send. Expected response — `200 OK`:** the full updated order, `"status": "cancelled"`, `cancellationReason` set to the exact string you sent.

- Same legality gate as the buyer's own cancel — only legal from `pending_payment` or `paid`. Once `processing` or later, neither the buyer's nor the admin's plain cancel path can stop it; a refund (see [`../payments/payments.api.md`](../payments/payments.api.md)) is the remaining option for a paid, already-shipping order.

### Error cases

**Missing/empty `reason`:**

```
400 Bad Request
```

```json
{ "success": false, "code": "VALIDATION_ERROR", "errors": { "reason": "Too small: expected string to have >=1 characters" } }
```

**Illegal transition** (order already `processing`/`shipped`/`delivered`/`cancelled`/`refunded`): same `409 INVALID_ORDER_TRANSITION` shape as `PATCH .../status` above.

Same `ORDER_NOT_FOUND`/`INVALID_ID`/`403 FORBIDDEN` shapes as `GET :id` above.

---

## Error Code Reference

Codes specific to this file, in addition to the ones already documented in [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`), [`../product-catalog/brands.api.md`](../product-catalog/brands.api.md#error-code-reference) (`INVALID_ID`), and [`orders.api.md`](./orders.api.md#error-code-reference) (`ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`):

No codes are unique to the admin surface — every code an admin can hit here is already documented in `orders.api.md`'s own reference table (the buyer/admin routers share the same service-level errors). The one behavioral difference worth restating: **`FORBIDDEN`** here always names `order-manager, super-admin` — a `catalog-manager` session is rejected on every route in this file, the reciprocal of the product-catalog admin routes.

---

## Money units

Whole rupees for every field this router itself owns (`totalAmount`, `items[].unitPrice`/`lineTotal`). The one exception is the payments-owned `POST .../refund`'s `amount` body field and the `payment.amount` summary attached to every list/detail response here — both paise, per [`../payments/payments.api.md`](../payments/payments.api.md).

---

## What's Not Here Yet

Refunds are documented in [`../payments/payments.api.md`](../payments/payments.api.md). There is no bulk status-update endpoint (one order at a time only), and no admin ability to edit an order's line items, quantities, or shipping address after it's placed — an order's `items`/`shippingAddress` are an immutable snapshot from checkout (SRS v0.5 §7).
