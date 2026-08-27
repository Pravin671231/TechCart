# Postman Manual — TechCart Backend API (Shopping Cart)

A step-by-step guide to testing the buyer shopping cart in Postman.

**Scope:** this document covers the cart module (SRS v0.4, `FR-CART-001`–`018` — Issues #150/#151): one persistent cart per authenticated buyer, variant-only line items, and live pricing/availability resolution on every read. Every endpoint is buyer-session-only (`rbac(["buyer"])`, `src/middleware/rbac.ts`); there is **no admin surface** — nobody manages another person's cart. No price or availability is ever stored on the cart: both are always re-derived from the referenced product variant at read time (`FR-CART-010`–`014`), so a catalog price change or a variant deactivation shows up on the next `GET /api/cart` with no cart-side write. See [`../../../backend/CLAUDE.md`](../../../backend/CLAUDE.md)'s Cart section for full implementation detail.

---

## Prerequisites

Same one-time collection setup as [`../product-catalog/uploads.api.md`](../product-catalog/uploads.api.md#one-time-postman-setup) (the `base_url` variable) and [`../authentication/auth.api.md`](../authentication/auth.api.md#one-time-postman-setup).

This doc needs:

- `buyer_access_token` — from [`../authentication/auth.api.md`](../authentication/auth.api.md#buyer-sign-in)'s email-OTP (or Google One Tap) sign-in. Every request below sends `Authorization: Bearer {{buyer_access_token}}`.
- **At least one published product with an active variant** — create one via [`../product-catalog/products.api.md`](../product-catalog/products.api.md) (product → variant → `PATCH .../status` to `published`), or run `npm run seed:upsert --workspace backend`. Copy a variant `_id` from `GET /api/products/:slug` (the `variants[]._id` or `defaultVariantId` field) into a collection variable `variant_id` for the requests below.

---

## `GET /api/cart`

Retrieves the signed-in buyer's current cart.

| Field  | Value                   |
| ------ | ----------------------- |
| Method | `GET`                   |
| URL    | `{{base_url}}/api/cart` |
| Name   | `Get Cart`              |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`** for a buyer who has never added anything (no cart document is created just by reading — `FR-CART-016`, never a 404):

```json
{
  "success": true,
  "data": { "items": [], "itemCount": 0, "subtotal": 0 }
}
```

After adding items (see `POST` below), the same call returns:

```json
{
  "success": true,
  "data": {
    "id": "66c1a2b3c4d5e6f7a8b9c0d1",
    "items": [
      {
        "variant": {
          "id": "66a4f1c8e3b7a91d2c8f4f01",
          "sku": "NOVA-X5P-128-BLK",
          "product": {
            "id": "66a4f1c8e3b7a91d2c8f4e01",
            "name": "Nova X5 Pro 5G",
            "slug": "nova-x5-pro-5g"
          },
          "attributes": [
            { "name": "Storage", "value": "128GB" },
            { "name": "Color", "value": "Midnight Black" }
          ],
          "primaryImage": {
            "url": "https://cdn.techcart.in/product-images/…webp",
            "alt": "Nova X5 Pro 5G"
          }
        },
        "quantity": 2,
        "sellingPrice": 4000000,
        "lineTotal": 8000000,
        "unavailable": false
      }
    ],
    "itemCount": 3,
    "subtotal": 8000000
  }
}
```

- `sellingPrice` / `lineTotal` are computed live from the variant on every read — never a value captured at add-to-cart time.
- `itemCount` sums quantity across **all** lines, including `unavailable` ones (`FR-CART-017`) — this is what a header badge shows.
- `subtotal` **excludes** `unavailable` lines (their `lineTotal` is `0`) — this is what checkout will actually charge. The two numbers deliberately tell different stories.
- `primaryImage` is `null` when the variant has no image.
- No `pagination` key ever appears on a cart response (`FR-CART-018`) — `data` is always one cart object.

### Error cases

**No session at all** (omit the `Authorization` header):

```
401 Unauthorized
```

```json
{ "success": false, "code": "UNAUTHENTICATED", "message": "Sign in required." }
```

**An admin session** (retry with an `admin_access_token`): `403 FORBIDDEN` — `"This action requires one of: buyer."` The cart is buyer-only, even for a super-admin.

---

## `POST /api/cart/items`

Adds a variant to the cart, or increases an existing line's quantity.

| Field  | Value                         |
| ------ | ----------------------------- |
| Method | `POST`                        |
| URL    | `{{base_url}}/api/cart/items` |
| Name   | `Add Cart Item`               |

**Headers tab:**

```
Authorization: Bearer {{buyer_access_token}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{ "variantId": "{{variant_id}}", "quantity": 2 }
```

- `quantity` — a positive integer, **1–10** (`FR-CART-005`). This is a hard business rule (bulk-buy / scalping mitigation), not a display clamp.
- The cart is created lazily on this first add (`FR-CART-001`) — there is no separate "create cart" call.
- Adding a variant already in the cart **combines** into the one existing line (`FR-CART-004`), it never creates a duplicate line.

**Click Send. Expected response — `200 OK`:** the full cart, same shape as `GET` above.

### Error cases

**`quantity` outside 1–10 in the request body** (e.g. `11` or `0`):

```
400 Bad Request
```

```json
{ "success": false, "code": "VALIDATION_ERROR", "errors": { "quantity": "…" } }
```

**Adding a quantity that would push an existing line above 10** (e.g. a line at `8`, adding `5`) — rejected outright, not clamped to 10 (`FR-CART-005`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "QUANTITY_OUT_OF_RANGE",
  "message": "Quantity per variant is capped at 10."
}
```

**A `variantId` that doesn't match any product variant** (`FR-CART-009`):

```
400 Bad Request
```

```json
{ "success": false, "code": "VARIANT_NOT_FOUND", "message": "Variant … does not exist." }
```

**A `variantId` that isn't a valid ObjectId string:** `400 VALIDATION_ERROR`, keyed on `variantId`.

---

## `PATCH /api/cart/items/:variantId`

Sets a line's quantity to an exact value.

| Field  | Value                                        |
| ------ | -------------------------------------------- |
| Method | `PATCH`                                      |
| URL    | `{{base_url}}/api/cart/items/{{variant_id}}` |
| Name   | `Update Cart Item Quantity`                  |

**Headers tab:** `Authorization` + `Content-Type: application/json`.

**Body tab → raw → JSON:**

```json
{ "quantity": 3 }
```

- `quantity` — an integer **0–10**. Setting it to `0` removes the line entirely, exactly like `DELETE .../items/:variantId` (`FR-CART-006`).

**Click Send. Expected response — `200 OK`:** the full updated cart.

### Error cases

**The variant isn't a line in the cart** (or the buyer has no cart yet):

```
404 Not Found
```

```json
{ "success": false, "code": "CART_ITEM_NOT_FOUND", "message": "No cart line for variant …." }
```

**`quantity` above 10 or below 0:** `400 VALIDATION_ERROR`.

---

## `DELETE /api/cart/items/:variantId`

Removes one line from the cart.

| Field  | Value                                        |
| ------ | -------------------------------------------- |
| Method | `DELETE`                                     |
| URL    | `{{base_url}}/api/cart/items/{{variant_id}}` |
| Name   | `Remove Cart Item`                           |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:** the full cart with that line gone.

### Error case

**The variant isn't a line in the cart:** `404 CART_ITEM_NOT_FOUND`, same shape as `PATCH` above.

---

## `DELETE /api/cart`

Clears every line in one call (`FR-CART-008`).

| Field  | Value                   |
| ------ | ----------------------- |
| Method | `DELETE`                |
| URL    | `{{base_url}}/api/cart` |
| Name   | `Clear Cart`            |

**Headers tab:** `Authorization: Bearer {{buyer_access_token}}`. No body.

**Click Send. Expected response — `200 OK`:**

```json
{ "success": true, "data": { "id": "…", "items": [], "itemCount": 0, "subtotal": 0 } }
```

Safe to call when the cart is already empty or was never created — still returns the empty shape.

---

## Testing live pricing & availability (`FR-CART-010`, `FR-CART-012`)

1. Add a variant with `POST /api/cart/items`, note its `sellingPrice` in the `GET /api/cart` response.
2. As an admin, `PATCH /api/admin/products/:id/variants/:variantId` to change that variant's `mrp`/`discount`.
3. `GET /api/cart` again — the line's `sellingPrice`/`lineTotal` and the cart `subtotal` reflect the new price, **with no cart-side update**.
4. As an admin, deactivate the variant (`PATCH .../variants/:variantId` with `"active": false`), or move the product out of `published`.
5. `GET /api/cart` — that line now has `"unavailable": true` and `"lineTotal": 0`, is **excluded from `subtotal`**, but still appears in `items` and is still counted in `itemCount` (`FR-CART-012`/`013`/`017`).

---

## Error Code Reference

| Code                    | Status | Where it comes from                                                                             |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`       | 401    | `src/middleware/rbac.ts` — no buyer session resolves from the request                           |
| `FORBIDDEN`             | 403    | `src/middleware/rbac.ts` — a real session whose role isn't `buyer`                              |
| `VALIDATION_ERROR`      | 400    | `errorHandler.ts` — a thrown `ZodError` (bad `variantId` shape, `quantity` out of 1–10 / 0–10)  |
| `VARIANT_NOT_FOUND`     | 400    | `cart.service.ts` `addItem` — the `variantId` matches no product variant (`FR-CART-009`)        |
| `QUANTITY_OUT_OF_RANGE` | 400    | `cart.service.ts` `addItem` — the combined line quantity would exceed the per-variant cap of 10 |
| `CART_ITEM_NOT_FOUND`   | 404    | `cart.service.ts` `updateItem`/`removeItem` — the variant is not a line in this buyer's cart    |

---

## What's Not Here Yet

Checkout / order creation (v0.5) reads the cart as its input and relies on each line's `unavailable` flag as the sole availability check — it is not part of this module. There is no guest/anonymous cart, no save-for-later, no coupon/promo mechanics, and no admin cart visibility (SRS v0.4 §7).
