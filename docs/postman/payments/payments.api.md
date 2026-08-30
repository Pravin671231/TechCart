# Postman Manual — TechCart Backend API (Payments)

A step-by-step guide to testing the Razorpay payment flow — mint, verify, and refund — in Postman.

**Scope:** this document covers the payments module (SRS v0.6, Issues #164/#165/#167): minting a Razorpay order for a pending order, verifying the Checkout widget's success callback, and admin-initiated full/partial refunds. **This module owns no router of its own** — its three endpoints are wired directly onto the `orders`/`orders-admin` routers, since two are order-scoped buyer actions and the third is an order-scoped admin action:

| Method | Path                                 | Guard                                        |
| ------ | ------------------------------------- | ---------------------------------------------- |
| `POST` | `/api/orders/:id/payment`            | `rbac(["buyer"])` + ownership (from `orders.routes.ts`)      |
| `POST` | `/api/orders/:id/payment/verify`     | `rbac(["buyer"])` + ownership (from `orders.routes.ts`)      |
| `POST` | `/api/admin/orders/:id/refund`       | `rbac(["order-manager","super-admin"])` (from `orders.admin.routes.ts`) |

See [`../order-management/orders.api.md`](../order-management/orders.api.md) and [`../order-management/ordersAdmin.api.md`](../order-management/ordersAdmin.api.md) for checkout/order-management itself, [`webhooks.api.md`](./webhooks.api.md) for the async Razorpay webhook, and [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Payments section for full implementation detail.

**⚠️ Paise, not rupees.** Every other money field in this API (`orders.totalAmount`, `items[].unitPrice`/`lineTotal`, dashboard revenue figures) is whole rupees. `payments.amount` and `payments.refunds[].amount` — the fields on this page — are the **one exception**: integer **paise**. The conversion happens exactly once, at `POST .../payment` time: `Math.round(order.totalAmount * 100)`.

**⚠️ Built against dummy Razorpay test credentials.** All three endpoints in this doc were verified against `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` test placeholders, not a real Razorpay test-mode account — real end-to-end verification (an actual Checkout widget popup, a real captured payment) needs the user's own Razorpay test keys in `backend/.env`.

---

## Prerequisites

Same one-time collection setup as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#one-time-postman-setup) and [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup).

- `buyer_access_token` — for `POST .../payment` and `.../payment/verify`.
- `admin_access_token` — for `POST .../refund`, signed in as an `order-manager` or `super-admin`.
- An order in `pending_payment` status — check out first, see [`../order-management/orders.api.md`](../order-management/orders.api.md#post-apiorders). Paste its `_id` into an `order_id` collection variable.

---

## `POST /api/orders/:id/payment`

Mints (or reuses) a Razorpay order for a pending TechCart order — the first step of paying for it.

| Field  | Value                                         |
| ------ | ------------------------------------------------ |
| Method | `POST`                                          |
| URL    | `{{base_url}}/api/orders/{{order_id}}/payment`  |
| Name   | `Initiate Payment`                              |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `201 Created`:**

```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_QwErTyUiOpAsDf",
    "amount": 8000000,
    "currency": "INR",
    "keyId": "rzp_test_xxxxxxxxxxxx"
  }
}
```

- `amount` is **integer paise** (`8000000` = ₹80,000.00, matching the order's `totalAmount: 80000` rupees from checkout).
- `keyId` is the Razorpay **public** key only — the response never includes a secret of any kind. Feed `razorpayOrderId`/`amount`/`currency`/`keyId` into the Razorpay Checkout widget client-side to open the payment sheet.
- **Idempotent**: calling this twice in a row for the same order reuses the exact same `razorpayOrderId` — no second Razorpay order is minted — as long as the latest attempt isn't `failed`. Confirm by calling it again and comparing `razorpayOrderId`.
- **Retry after failure**: if the latest attempt did fail (see [`/payment/verify`](#post-apiordersidpaymentverify) below), calling this again mints a genuinely **new** Razorpay order — a fresh retry, not a reuse.

### Error cases

**Order doesn't exist, or isn't owned by the calling buyer** (both collapse to the identical response, non-enumerable):

```
404 Not Found
```

```json
{ "success": false, "code": "ORDER_NOT_FOUND", "message": "Order 66d2b3c4d5e6f7a8b9c0d1e2 was not found." }
```

**Order isn't `pending_payment`** (e.g. already `paid`, or `cancelled`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "PAYMENT_NOT_ALLOWED",
  "message": "Cannot initiate payment for an order with status 'paid'."
}
```

**Malformed `:id`:** `400 INVALID_ID`.

Same `UNAUTHENTICATED`/`403 FORBIDDEN` (non-buyer session) shapes as every other buyer endpoint in this API.

---

## `POST /api/orders/:id/payment/verify`

Verifies the Razorpay Checkout widget's success callback — the point where a payment actually gets marked captured and the order flips to `paid`.

| Field  | Value                                                 |
| ------ | -------------------------------------------------------- |
| Method | `POST`                                                  |
| URL    | `{{base_url}}/api/orders/{{order_id}}/payment/verify`   |
| Name   | `Verify Payment`                                        |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (these three values come from the Checkout widget's `handler` callback in a real browser flow):

```json
{
  "razorpayOrderId": "order_QwErTyUiOpAsDf",
  "razorpayPaymentId": "pay_AbCdEfGhIjKlMn",
  "razorpaySignature": "3f9c2b1a...hex-hmac..."
}
```

- All three fields are **required** — the widget's real success callback always supplies all three together, so there's no meaningful "partial" verify request.
- The signature check is `HMAC-SHA256("<razorpayOrderId>|<razorpayPaymentId>", RAZORPAY_KEY_SECRET)`, hex digest, compared with `crypto.timingSafeEqual`. There's no practical way to fabricate a valid one by hand without the real secret and a real Razorpay payment — this endpoint is really only testable end-to-end against a real (test-mode) Razorpay account.

**Click Send. Expected response on success — `200 OK`:** the full updated order (same shape as [`../order-management/orders.api.md`](../order-management/orders.api.md#get-apiordersid)'s detail), now `"status": "paid"`:

```json
{
  "success": true,
  "data": {
    "id": "66d2b3c4d5e6f7a8b9c0d1e2",
    "orderNumber": "TC-2026-000001",
    "status": "paid",
    "items": [{ "...": "..." }],
    "shippingAddress": { "...": "..." },
    "totalAmount": 80000,
    "statusHistory": [
      { "status": "pending_payment", "at": "2026-08-30T10:00:00.000Z" },
      { "status": "paid", "at": "2026-08-30T10:00:05.000Z" }
    ],
    "createdAt": "2026-08-30T10:00:00.000Z"
  }
}
```

### Error cases

**Signature doesn't verify** (a tampered/incorrect `razorpaySignature`): the payment is marked `failed`, and **the order is deliberately left `pending_payment`** so the buyer can retry via `POST .../payment` above — nothing about the order itself changes:

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "PAYMENT_VERIFICATION_FAILED",
  "message": "Payment signature verification failed."
}
```

**`razorpayOrderId` doesn't match any payment attempt recorded against this order:**

```
404 Not Found
```

```json
{ "success": false, "code": "PAYMENT_NOT_FOUND", "message": "No matching payment attempt for this order." }
```

**Missing/empty body field:** `400 VALIDATION_ERROR`, keyed on whichever of `razorpayOrderId`/`razorpayPaymentId`/`razorpaySignature` is missing.

Same `ORDER_NOT_FOUND`/`INVALID_ID`/`UNAUTHENTICATED`/`403 FORBIDDEN` shapes as `POST .../payment` above.

---

## `POST /api/admin/orders/:id/refund`

Refunds a captured payment — the whole remaining balance, or a specific partial amount.

| Field  | Value                                              |
| ------ | ----------------------------------------------------- |
| Method | `POST`                                              |
| URL    | `{{base_url}}/api/admin/orders/{{order_id}}/refund` |
| Name   | `Refund Order`                                      |

**Headers tab:**

```
Authorization: Bearer {{admin_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON** (full refund — `amount` omitted):

```json
{ "reason": "Customer returned the item, full refund approved." }
```

**Body tab → raw → JSON** (partial refund — `amount` in paise):

```json
{ "amount": 2000000, "reason": "Partial refund for one damaged unit." }
```

- `amount` — optional, integer **paise**, positive. Omitted → refunds the **entire remaining refundable balance** (the payment's captured amount minus anything already refunded).
- `reason` — **required**, minimum 1 character. Recorded verbatim on the refund entry (and, for a full refund, as the order's cancellation-adjacent status-history note).

**Click Send. Expected response — full refund — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "66d2b3c4d5e6f7a8b9c0d1e2",
    "orderNumber": "TC-2026-000001",
    "status": "refunded",
    "buyer": { "id": "...", "name": "Asha Rao", "email": "buyer@example.com" },
    "items": [{ "...": "..." }],
    "totalAmount": 80000,
    "statusHistory": [
      { "...": "... earlier entries ..." },
      { "status": "refunded", "at": "2026-08-30T11:00:00.000Z", "note": "Customer returned the item, full refund approved." }
    ],
    "createdAt": "..."
  }
}
```

**Expected response — partial refund — `200 OK`:** the identical shape, **except `data.status` stays whatever it was before** (e.g. `"paid"`) — a partial refund never changes the order's own status field, since there's no "partially refunded" order status in the lifecycle at all. Only the underlying `payments.status` becomes `"partially_refunded"` (not directly visible on this response, but reflected in the `payment` summary attached to [`../order-management/ordersAdmin.api.md`](../order-management/ordersAdmin.api.md#get-apiadminordersid)'s detail).

### Full vs. partial refund — side by side

|                        | Full refund (`amount` omitted, or equal to the full refundable balance) | Partial refund (`amount` < refundable balance)         |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `payments.status`      | `"refunded"`                                                                 | `"partially_refunded"`                                     |
| `orders.status`        | Transitions to `"refunded"`                                                  | **Untouched** — stays `paid`/`processing`/`shipped`/`delivered` |
| Repeatable?            | No — the refundable balance is now `0`; a further attempt fails `REFUND_AMOUNT_INVALID` | Yes — a second partial refund can follow, netted against what's already been refunded |

### Error cases

**Latest payment isn't `captured`/`partially_refunded`, has no `razorpayPaymentId`, or no payment attempt exists at all:**

```
400 Bad Request
```

```json
{ "success": false, "code": "REFUND_NOT_ALLOWED", "message": "This order has no captured payment eligible for refund." }
```

**Requested `amount` is zero/negative, or exceeds the remaining refundable balance:**

```
400 Bad Request
```

```json
{ "success": false, "code": "REFUND_AMOUNT_INVALID", "message": "Refund amount must be between 1 and 6000000 paise." }
```

**Missing `reason`, or `amount` not a positive integer:** `400 VALIDATION_ERROR`.

**A `catalog-manager` session:**

```
403 Forbidden
```

```json
{ "success": false, "code": "FORBIDDEN", "message": "This action requires one of: order-manager, super-admin." }
```

Same `ORDER_NOT_FOUND`-adjacent behavior does **not** apply here — a nonexistent order id still resolves through to `REFUND_NOT_ALLOWED` (no payment found), rather than a distinct `ORDER_NOT_FOUND`. Malformed `:id` → `400 INVALID_ID`.

---

## The `payment` summary on order reads

`GET /api/orders/:id`, `GET /api/admin/orders/:id`, and `GET /api/admin/orders` (list) each attach a compact `payment` field — this is not a standalone endpoint, just a cross-reference:

```ts
payment: { status: PaymentStatus; amount: number /* paise */; razorpayPaymentId?: string } | null
```

`null` until the order's first `POST .../payment` call; `razorpayPaymentId` is present only once a payment has actually reached the Razorpay side (i.e. not on a bare `"created"` attempt). See [`../order-management/orders.api.md`](../order-management/orders.api.md#get-apiordersid) / [`../order-management/ordersAdmin.api.md`](../order-management/ordersAdmin.api.md#get-apiadminordersid) for it in context.

---

## Error Code Reference

| Code                          | Status | Where it comes from                                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------ |
| `INVALID_ID`                  | 400    | `:id` route param isn't a valid ObjectId (all three endpoints)                                              |
| `VALIDATION_ERROR`            | 400    | Zod schema failure — missing/empty verify or refund body field                                              |
| `UNAUTHENTICATED`             | 401    | No/invalid session                                                                                            |
| `FORBIDDEN`                   | 403    | Session role not allowed on that route (`buyer` for initiate/verify, `order-manager`/`super-admin` for refund) |
| `ORDER_NOT_FOUND`             | 404    | Order doesn't exist or isn't owned by the calling buyer (initiate, verify only)                              |
| `PAYMENT_NOT_ALLOWED`         | 400    | `POST .../payment` on an order that isn't `pending_payment`                                                  |
| `PAYMENT_NOT_FOUND`           | 404    | `POST .../verify`'s `razorpayOrderId` doesn't match any attempt on this order                                |
| `PAYMENT_VERIFICATION_FAILED` | 400    | HMAC signature check fails — payment marked `failed`, order left `pending_payment`                           |
| `REFUND_NOT_ALLOWED`          | 400    | No `captured`/`partially_refunded` payment to refund                                                          |
| `REFUND_AMOUNT_INVALID`       | 400    | Requested refund amount ≤ 0 or exceeds the remaining refundable balance                                      |

---

## What's Not Here Yet

The async Razorpay webhook (`POST /api/webhooks/razorpay`) — the source of truth for payment state independent of the buyer's browser ever calling `/verify` — is documented separately in [`webhooks.api.md`](./webhooks.api.md). There is no partial-item refund tied to specific order lines (a refund is always against the payment as a whole), and no support for any payment method other than Razorpay.
