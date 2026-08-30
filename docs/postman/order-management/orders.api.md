# Postman Manual — TechCart Backend API (Orders — Buyer)

A step-by-step guide to testing buyer checkout and order history in Postman.

**Scope:** this document covers the buyer-facing half of the Orders module (SRS v0.5, Issues #155–157): checkout from the cart, order history, order detail, and self-cancellation. Every route is buyer-session-only (`rbac(["buyer"])`, `src/middleware/rbac.ts`), mounted at `/api/orders`. See [`ordersAdmin.api.md`](./ordersAdmin.api.md) for the admin-facing order list/detail/status/cancel endpoints, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Orders section for full implementation detail.

**Related — Payments:** `POST /api/orders/:id/payment` and `POST /api/orders/:id/payment/verify` are wired onto this exact router (they reuse its buyer + ownership guard) but are documented separately, since they belong to the payments module:

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------- |
| `POST` | `/api/orders/:id/payment`         | Mint a Razorpay order for a pending order |
| `POST` | `/api/orders/:id/payment/verify`  | Verify the Checkout widget's callback     |

Full request/response examples and error cases: see [`../payments/payments.api.md`](../payments/payments.api.md).

---

## Prerequisites

Same one-time collection setup as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#one-time-postman-setup) and [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup).

- `buyer_access_token` — from [`../authentication/auth.api.md`](../authentication/auth.api.md#buyer-sign-in)'s email-OTP (or Google One Tap) sign-in.
- **A non-empty cart** — checkout is built entirely from the buyer's server-side cart, not from anything the request body sends. Add at least one item via [`../shopping-cart/cart.api.md`](../shopping-cart/cart.api.md)'s `POST /api/cart/items` first.
- **A shipping address** — either a saved one from [`addresses.api.md`](./addresses.api.md) (paste its `_id` into an `address_id` collection variable), or be ready to submit a one-off address inline (see `POST /api/orders` below).

**Optional collection variable:** add `order_id` (leave empty) so you can paste a created order's `_id` into it and reuse `{{order_id}}` across the requests below.

---

## `POST /api/orders`

Checks out the buyer's current cart into a new order — the only way an order is created.

| Field  | Value                    |
| ------ | -------------------------- |
| Method | `POST`                   |
| URL    | `{{base_url}}/api/orders` |
| Name   | `Checkout`               |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (option A — use a saved address):

```json
{ "addressId": "{{address_id}}" }
```

**Body tab → raw → JSON** (option B — submit a one-off address; it also gets saved into the buyer's address book as a side effect):

```json
{
  "shippingAddress": {
    "fullName": "Asha Rao",
    "phone": "9876543210",
    "line1": "221B, Residency Road",
    "city": "Bengaluru",
    "state": "Karnataka",
    "pincode": "560025"
  }
}
```

**Body tab → raw → JSON** (option C — send neither; falls back to the buyer's default address, see below):

```json
{}
```

- `addressId` and `shippingAddress` are both optional but **mutually exclusive** — sending both is a validation error (see below).
- **Address resolution priority**, in order: (1) `addressId`, resolved via the address book — must be owned by the caller; (2) `shippingAddress`, validated against the same shape as [`addresses.api.md`](./addresses.api.md#post-apiaddresses)'s create body, and **saved as a new address-book entry** as a side effect (checkout implicitly adds it to `GET /api/addresses`); (3) neither given → the buyer's current default address (`isDefault: true`); if none of the three resolves, the request fails with `ADDRESS_REQUIRED` below.
- **There is no `items`/`cart`/`totalAmount` field in this body at all** — the order's line items and total are always derived from the buyer's live cart at the moment of the call. A client-supplied `totalAmount` (or any other unrecognized field) is silently ignored, never used.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "id": "66d2b3c4d5e6f7a8b9c0d1e2",
    "orderNumber": "TC-2026-000001",
    "user": "66a1f0c9e4b0a1a2b3c4d5e6",
    "status": "pending_payment",
    "items": [
      {
        "product": { "id": "66a4f1c8e3b7a91d2c8f4e01", "name": "Nova X5 Pro 5G", "slug": "nova-x5-pro-5g" },
        "variant": {
          "id": "66a4f1c8e3b7a91d2c8f4f01",
          "sku": "NOVA-X5P-128-BLK",
          "attributes": [
            { "name": "Storage", "value": "128GB" },
            { "name": "Color", "value": "Midnight Black" }
          ],
          "image": { "url": "https://cdn.techcart.in/product-images/…webp", "alt": "Nova X5 Pro 5G" }
        },
        "unitPrice": 40000,
        "quantity": 2,
        "lineTotal": 80000
      }
    ],
    "shippingAddress": {
      "fullName": "Asha Rao",
      "phone": "9876543210",
      "line1": "221B, Residency Road",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560025"
    },
    "totalAmount": 80000,
    "statusHistory": [{ "status": "pending_payment", "at": "2026-08-30T10:00:00.000Z" }],
    "createdAt": "2026-08-30T10:00:00.000Z"
  }
}
```

- Every line, image, and attribute is a **frozen snapshot** taken at checkout — never a live reference. Later renaming the product, changing its price, or deleting an image has no effect on an already-placed order.
- `orderNumber` — format `TC-<year>-<6-digit zero-padded sequence>` (e.g. `TC-2026-000001`), a **globally incrementing** sequence that never resets per year — only the year prefix reflects the actual creation date.
- `status` always starts `"pending_payment"` — use [`../payments/payments.api.md`](../payments/payments.api.md) next to actually pay for it.
- `totalAmount`/`unitPrice`/`lineTotal` are **whole rupees** here, not paise (unlike `payments.amount`, the one paise-denominated field family in this API — see [`../payments/payments.api.md`](../payments/payments.api.md)).
- `trackingReference`/`cancellationReason` keys are **omitted entirely** (not `null`) when unset — true of every order response in this API.
- **Only the cart lines that made it into the order are removed from the cart** — confirm by calling `GET /api/cart` afterward.

### Dropped items (`droppedItems`)

If the cart contained a line the buyer added earlier but that's since become unavailable (its variant was deactivated, its product unpublished, or its quantity now exceeds the cap), checkout **silently drops that line and proceeds** rather than blocking the whole checkout. The response then carries an extra key:

```json
{
  "success": true,
  "data": {
    "...": "... every field above ...",
    "droppedItems": [{ "sku": "NOVA-X5P-256-SLV", "reason": "VARIANT_UNAVAILABLE" }]
  }
}
```

- **`droppedItems` is only present at all when at least one item was actually dropped** — omitted entirely on a clean checkout, never sent as an empty array.
- `reason` is always the literal string `"VARIANT_UNAVAILABLE"` — the only drop reason this system implements.
- A dropped line **stays in the buyer's cart** afterward, for them to deal with separately — it is not silently deleted.
- If **every** line in the cart is unavailable (or the cart is empty to begin with), checkout fails outright with `CART_EMPTY` below rather than creating a zero-item order.

### Error cases

**Both `addressId` and `shippingAddress` submitted together:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": { "": "Provide either addressId or shippingAddress, not both." }
}
```

**Malformed `shippingAddress` field (e.g. bad `pincode`):** same `VALIDATION_ERROR` shape as [`addresses.api.md`](./addresses.api.md#post-apiaddresses)'s create.

**Cart is empty, or every line in it is unavailable:**

```
400 Bad Request
```

```json
{ "success": false, "code": "CART_EMPTY", "message": "Your cart has no available items to check out." }
```

**No `addressId`/`shippingAddress` given and the buyer has no default address either:**

```
400 Bad Request
```

```json
{ "success": false, "code": "ADDRESS_REQUIRED", "message": "A shipping address is required to place an order." }
```

**`addressId` doesn't resolve to an address owned by the caller:** same `ADDRESS_NOT_FOUND` shape as [`addresses.api.md`](./addresses.api.md#patch-apiaddressesid).

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as every other endpoint in this doc for a missing/non-buyer session.

---

## `GET /api/orders`

Lists the signed-in buyer's own order history, paginated, newest first.

| Field  | Value                    |
| ------ | -------------------------- |
| Method | `GET`                    |
| URL    | `{{base_url}}/api/orders` |
| Name   | `List My Orders`         |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Query params (both optional):**

| Param   | Values         | Default |
| ------- | -------------- | ------- |
| `page`  | integer ≥ 1    | `1`     |
| `limit` | integer 1–100  | `20`    |

There is **no `search`/`status`/`sortBy` dimension on this endpoint** — it's a plain, own-orders-only, newest-first list. (The admin list in [`ordersAdmin.api.md`](./ordersAdmin.api.md) has the fuller filter/sort surface.)

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": [{ "...": "... same OrderResponse shape as checkout's data, minus droppedItems ..." }],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false }
}
```

- Only the calling buyer's own orders ever appear — never another buyer's.

### Error cases

**Out-of-range `page`/`limit`:** `400 VALIDATION_ERROR`, same shape as the admin product list's pagination errors.

Same `UNAUTHENTICATED`/`FORBIDDEN` shapes as above.

---

## `GET /api/orders/:id`

Fetches one of the buyer's own orders by id, including its latest payment status.

| Field  | Value                                    |
| ------ | ------------------------------------------ |
| Method | `GET`                                    |
| URL    | `{{base_url}}/api/orders/{{order_id}}`   |
| Name   | `Get My Order`                           |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "...": "... same OrderResponse shape as checkout's data ...",
    "payment": { "status": "captured", "amount": 8000000, "razorpayPaymentId": "pay_..." }
  }
}
```

- `payment` is a compact summary (`{status, amount, razorpayPaymentId?}`) — `null` when no payment attempt has ever been made for this order (e.g. right after checkout, before hitting `POST .../payment`). See [`../payments/payments.api.md`](../payments/payments.api.md) for the full payment lifecycle. Note `payment.amount` here is **paise** — the one field on this response that isn't whole rupees, matching `payments.amount`'s own convention.
- `statusHistory` lists every transition this order has ever gone through, each with an ISO `at` timestamp and an optional `note`.

### Error cases

**`:id` doesn't exist, or belongs to another buyer** (both collapse to the identical response — non-enumerable, so a buyer can't probe for other buyers' order ids):

```
404 Not Found
```

```json
{ "success": false, "code": "ORDER_NOT_FOUND", "message": "Order 66d2b3c4d5e6f7a8b9c0d1e2 was not found." }
```

**Malformed `:id`:** `400 INVALID_ID`, same shape as every other module's malformed-id case.

---

## `POST /api/orders/:id/cancel`

Cancels one of the buyer's own orders — self-service, no admin action required, as long as it hasn't started shipping.

| Field  | Value                                          |
| ------ | ------------------------------------------------ |
| Method | `POST`                                          |
| URL    | `{{base_url}}/api/orders/{{order_id}}/cancel`   |
| Name   | `Cancel My Order`                               |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body — no reason is collected on a buyer self-cancel (contrast with the admin cancel in [`ordersAdmin.api.md`](./ordersAdmin.api.md), which requires one).

**Click Send. Expected response — `200 OK`:** the full updated order, `"status": "cancelled"`.

- **Legal only from `pending_payment` or `paid`** — see the [Order Status Lifecycle](#order-status-lifecycle) below. Once an order has moved to `processing`, neither the buyer nor an admin's plain cancel path can stop it — see error case below.
- No `cancellationReason` is ever recorded on a buyer self-cancel — that field only ever gets set by the admin cancel endpoint.

### Error cases

Same `ORDER_NOT_FOUND`/`INVALID_ID` shapes as `GET /api/orders/:id` above.

**Order already past `paid`** (e.g. `processing`, `shipped`, `delivered`) **or already `cancelled`/`refunded`:**

```
409 Conflict
```

```json
{
  "success": false,
  "code": "INVALID_ORDER_TRANSITION",
  "message": "Cannot move an order from 'processing' to 'cancelled'."
}
```

The message always names the order's actual current status and the attempted target verbatim.

---

## Order Status Lifecycle

Every status change in this system — buyer cancel, admin status advance, admin cancel, a successful payment, a refund, or the 30-minute auto-cancel sweep for stale unpaid orders — goes through the identical state machine (`orders.stateMachine.ts`'s `assertTransition`). An illegal move always fails `409 INVALID_ORDER_TRANSITION`, never silently no-ops.

| From              | Legal `to` values                    |
| ----------------- | -------------------------------------- |
| `pending_payment` | `paid`, `cancelled`                  |
| `paid`             | `processing`, `cancelled`, `refunded` |
| `processing`       | `shipped`, `refunded`                |
| `shipped`          | `delivered`, `refunded`              |
| `delivered`        | `refunded`                            |
| `cancelled`        | *(terminal — no further transitions)* |
| `refunded`         | *(terminal — no further transitions)* |

- **`cancelled` is reachable only from `pending_payment` or `paid`** — never from `processing`/`shipped`/`delivered`, for either the buyer's own cancel above or the admin cancel in [`ordersAdmin.api.md`](./ordersAdmin.api.md).
- **`refunded` is reachable from any post-payment state** (`paid`, `processing`, `shipped`, `delivered`) but never from `pending_payment` (nothing paid yet to refund) or `cancelled` (already terminal).
- **`shipped` is reached only from `processing`** — never directly from `paid`.
- A `pending_payment` order left unpaid for **30 minutes** is auto-cancelled by a background sweep (no buyer/admin action needed) — its `statusHistory` shows a `cancelled` entry with a note explaining the auto-cancel.
- Every notifiable transition (`paid`, `shipped`, `delivered`, `cancelled`) queues a status-update email to the buyer — `processing` does not.

---

## Error Code Reference

Order-specific codes, in addition to the ones already documented in [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#error-code-reference) (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`) and [`../product-catalog/brands.api.md`](../product-catalog/brands.api.md#error-code-reference) (`INVALID_ID`):

| Code                       | Status | Where it comes from                                                                          | Reachable via an existing endpoint? |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| `CART_EMPTY`                | 400    | `orders.service.ts`'s checkout — zero available (non-`unavailable`) cart lines to check out    | Yes                                     |
| `ADDRESS_REQUIRED`          | 400    | `orders.service.ts`'s checkout — no `addressId`/`shippingAddress` given and no default address | Yes                                     |
| `ADDRESS_NOT_FOUND`         | 404    | bubbled from the addresses module — `addressId` doesn't resolve to an owned address           | Yes                                     |
| `ORDER_NOT_FOUND`           | 404    | `orders.service.ts` — `:id` doesn't exist, or isn't owned by the calling buyer                | Yes                                     |
| `INVALID_ORDER_TRANSITION`  | 409    | `orders.stateMachine.ts`'s `assertTransition` — an illegal status move (e.g. cancel after ship) | Yes                                     |

---

## What's Not Here Yet

Payment initiation/verification (`POST .../payment`, `POST .../payment/verify`) and refunds are documented in [`../payments/payments.api.md`](../payments/payments.api.md). There is no partial-item cancellation (a cancel always applies to the whole order), no guest/unauthenticated checkout, and no buyer-initiated return/exchange flow beyond the cancel window above (SRS v0.5 §7).
