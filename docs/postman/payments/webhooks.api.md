# Postman Manual — TechCart Backend API (Razorpay Webhook)

A step-by-step guide to testing the async Razorpay payment webhook in Postman.

**Scope:** this document covers the webhooks module (SRS v0.6, Issue #166): the one endpoint Razorpay itself calls asynchronously when a payment's state changes server-side — the source of truth for payment status independent of whether the buyer's browser ever successfully calls `POST /api/orders/:id/payment/verify` (see [`payments.api.md`](./payments.api.md)). This endpoint has **no `rbac()` guard, no session, no `X-Admin-Key`, nothing** — it's authenticated by a cryptographic signature alone (`FR-PAY-024`). See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Payments section for full implementation detail.

**Mounting note:** unlike every other route in this API, this one is registered **ahead of** the app's shared `express.json()` middleware and applies its own `express.raw({type: "application/json"})` per-route — it needs the exact raw, unparsed request body bytes to verify the signature. If you're reading this to understand the backend rather than just to test it: this mirrors the same precedent the `auth` module set for its own early-mounted routes.

---

## Prerequisites

Same `base_url` collection setup as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#one-time-postman-setup) — **no bearer token needed at all** for this one endpoint. You do need the backend's `RAZORPAY_WEBHOOK_SECRET` value (from `backend/.env`) to compute a valid signature — see below.

An existing payment attempt helps make a request that actually does something (rather than a harmless no-op) — check out and initiate a payment first (see [`../order-management/orders.api.md`](../order-management/orders.api.md) and [`payments.api.md`](./payments.api.md#post-apiordersidpayment)), and note its `razorpayOrderId`.

---

## `POST /api/webhooks/razorpay`

| Field  | Value                                  |
| ------ | ----------------------------------------- |
| Method | `POST`                                  |
| URL    | `{{base_url}}/api/webhooks/razorpay`    |
| Name   | `Razorpay Webhook`                      |

**Headers tab:**

```
Content-Type: application/json
X-Razorpay-Signature: <computed HMAC — see below>
```

`X-Razorpay-Event-Id` is optional but recommended (see idempotency below) — Razorpay always sends one in a real delivery.

**Body tab → raw → JSON** (a `payment.captured` event — the body Postman actually sends must be byte-identical to what you signed, see below):

```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_AbCdEfGhIjKlMn",
        "order_id": "order_QwErTyUiOpAsDf",
        "status": "captured"
      }
    }
  }
}
```

**Click Send. Expected response — `200 OK`:**

```json
{ "success": true }
```

- **Note the shape**: this is a bespoke `{"success": true}` literal — **there's no `data` key at all**, unlike every other endpoint in this entire API.
- On `"payment.captured"`: if the matching `Payment` document (found by `payload.payment.entity.order_id`) isn't already `captured`, it's marked `captured` and the order transitions to `paid` — same effect as a successful `/payment/verify` call, just triggered server-side instead of by the buyer's browser.
- On `"payment.failed"`: if the payment is still in its initial `"created"` state, it's marked `failed`.
- **Any other event type, or a body that doesn't correlate to a known payment (unrecognized `order_id`), is a silent no-op — still `200`.** This is deliberate: Razorpay would otherwise keep retrying a webhook it never gets acknowledged.

### Computing a valid `X-Razorpay-Signature` for Postman

The signature is **HMAC-SHA256 over the exact raw bytes of the request body**, keyed by `RAZORPAY_WEBHOOK_SECRET` (a **different** secret than `RAZORPAY_KEY_SECRET`, which `/payment/verify` uses — this one is configured separately wherever the webhook URL is registered in the Razorpay Dashboard), hex-encoded.

**This is the one tricky part of testing this endpoint by hand**: the signature must match the *exact byte-for-byte string* you actually send — if Postman (or any tool) re-serializes your JSON object with different key order or whitespace before sending, the signature you computed won't match what arrives, and you'll get `INVALID_WEBHOOK_SIGNATURE` even with the "right" secret.

**Recommended approach — a Postman pre-request script:**

```js
const crypto = require("crypto");
const rawBody = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_AbCdEfGhIjKlMn", order_id: "order_QwErTyUiOpAsDf", status: "captured" } } }
});
const secret = pm.environment.get("razorpay_webhook_secret"); // set this collection/environment variable from backend/.env's RAZORPAY_WEBHOOK_SECRET
const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
pm.variables.set("computed_signature", signature);
pm.variables.set("computed_raw_body", rawBody);
```

Then set the **Body** tab to `{{computed_raw_body}}` (raw text, not "JSON" beautified — so Postman sends it verbatim) and the header to `X-Razorpay-Signature: {{computed_signature}}`.

Equivalent from a plain terminal, if you'd rather build the body once and reuse it:

```bash
RAW_BODY='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_AbCdEfGhIjKlMn","order_id":"order_QwErTyUiOpAsDf","status":"captured"}}}}'
echo -n "$RAW_BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET"
```

Paste the resulting hex digest as the `X-Razorpay-Signature` header, and send `$RAW_BODY` as the literal request body.

### Idempotency (`webhookEvents[]`)

Every processed event is recorded against the specific `Payment` document: `{eventId, type, receivedAt}`. `eventId` is the `X-Razorpay-Event-Id` header when present, or a deterministic fallback (`"<event>:<payment id>"`) when it's missing — so a redelivery of the same event, with or without the header, is recognized as a duplicate and **skipped entirely** (no re-processing, no double `paid` transition), still returning `200`. This is enforced twice: an in-code check before any write, and a unique sparse index on `webhookEvents.eventId` across the whole `payments` collection as a database-level backstop.

### Error cases

**Missing `X-Razorpay-Signature` header:**

```
400 Bad Request
```

```json
{ "success": false, "code": "MISSING_WEBHOOK_SIGNATURE", "message": "Missing webhook signature header." }
```

**Signature present but doesn't verify** (wrong secret, or the body doesn't match what was signed):

```
400 Bad Request
```

```json
{ "success": false, "code": "INVALID_WEBHOOK_SIGNATURE", "message": "Webhook signature verification failed." }
```

---

## Error Code Reference

| Code                         | Status | Where it comes from                                                        |
| ----------------------------- | ------ | ------------------------------------------------------------------------------ |
| `MISSING_WEBHOOK_SIGNATURE`   | 400    | `payments.controller.ts` — `x-razorpay-signature` header absent               |
| `INVALID_WEBHOOK_SIGNATURE`   | 400    | `verifyWebhookSignature` — the HMAC doesn't match the raw body under `RAZORPAY_WEBHOOK_SECRET` |

A malformed-but-validly-signed JSON body isn't a distinct documented error — it isn't specifically caught, and would surface as a generic `500 INTERNAL_ERROR`; no test covers this edge case since it isn't something Razorpay's own SDK would ever actually send.

---

## What's Not Here Yet

There's no way to view a payment's raw `webhookEvents[]` log through any API endpoint — it's an internal audit trail only, inspectable directly in MongoDB. This endpoint never returns anything other than `200`/`400` — there's no `404`/`403` here at all, since it isn't scoped to any session or resource ownership.
