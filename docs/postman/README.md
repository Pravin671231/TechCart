# TechCart Backend API — Postman Manuals Index

This folder is a set of hand-written, step-by-step guides for testing TechCart's backend API by hand in Postman — one file per backend module, each with request/response examples and error cases. It is **not** an exported Postman collection JSON file; there is no `.postman_collection.json` to import here, just markdown walkthroughs.

Before opening any file below, do the one-time collection setup: the `base_url` variable ([`product-catalog/uploads.api.md`](./product-catalog/uploads.api.md#one-time-postman-setup)) and then [`authentication/auth.api.md`](./authentication/auth.api.md#one-time-postman-setup)'s `buyer_access_token`/`admin_access_token` variables — the latter hold the bearer tokens **every** admin and account request in this folder needs (`Authorization: Bearer <token>`), so complete an admin sign-in before working through `product-catalog/`. Every other doc assumes that setup is done and reuses the same collection.

This index covers seven domains: M2 (Product Catalog) — Issues #25 through #36, plus Issue #102 (SRS v0.2 amendment: variant-only pricing, stock/inventory tracking removed), Issue #104 (SRS v0.2 amendment: shared admin list pagination/sort), Issue #189 (SRS v0.10/M10.1 amendment: `availability`/`inStock` reinstated, inventory-backed), and Issue #326 (SRS v0.2 amendment: buyer faceted filter discovery, `GET /api/categories/:slug/filters`); M3 (Authentication) — buyer sign-in, admin sign-in + password reset, admin account provisioning, and account self-service (`FR-AUTH-001`–`045`), plus the buyer dashboard read (Issue #173); M4 (Shopping Cart) — the buyer cart (`FR-CART-001`–`018`, Issues #150/#151), plus warehouse-stock allocation (Issue #190/M10.2); M5 (Order Management) — the buyer address book, checkout, order history, and admin order management (Issues #154–#158); M6 (Payments) — Razorpay payment mint/verify, refunds, and the async webhook (Issues #164–#167); M7 (Dashboard) — admin sales/catalog aggregation reads (Issues #171–#172); and M10 (Inventory) — per-warehouse stock tracking (Issue #189).

**M5–M10 shipped ahead of their own Postman docs** — Issue #329 is the catch-up that added the Order Management, Payments, Dashboard, and Inventory sections below, plus refreshed three docs that had drifted (`product-catalog/products.api.md`'s `availability`/`inStock`, `authentication/account.api.md`'s dashboard endpoint, `shopping-cart/cart.api.md`'s `INSUFFICIENT_STOCK` case).

**Admin auth is session-based, not `X-Admin-Key`.** Issue #143/M3.5 replaced the temporary `X-Admin-Key` header with real session + role authentication (`src/middleware/rbac.ts`) on every `/api/admin/*` route, and Issue #264/M3.26 updated the `product-catalog/*.api.md` docs to match — a real request against `/api/admin/brands`, `/api/admin/categories`, etc. sends `Authorization: Bearer <token>` from [`authentication/auth.api.md`](./authentication/auth.api.md)'s admin sign-in flow. The backend auth engine itself was rewritten from Better Auth to a hand-rolled custom session/OTP engine in Issues #258–#261 (M3.19–23); the `/api/auth/*` wire contract was preserved, and the `authentication/*.api.md` docs were re-verified against it in #264.

---

## Conventions for New Endpoints

Two standing rules for this folder, in effect from Issue #224 onward:

1. **Every backend API endpoint created or updated — in any feature, not just Authentication — must have its `docs/postman/<feature>/*.api.md` walkthrough created or updated in the same PR.** No endpoint ships without a matching Postman doc.
2. **Every `docs/postman/<feature>/` folder follows `product-catalog/`'s structure exactly**: one `.api.md` file per backend module, a per-file endpoint table, and a `docs/postman/README.md` index entry (both a files-table row and a full-endpoint-index row) — no ad hoc layout or naming per feature.

---

## Product Catalog

### Files, in recommended setup order

Do [`authentication/auth.api.md`](./authentication/auth.api.md)'s admin sign-in first — every `/api/admin/*` request below needs the `admin_access_token` it produces. Then, since a product can't exist without a brand and a category, work through these roughly in order the first time:

| #   | File                                                                               | Covers                                                                                                                                       | Issues                             |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | [`uploads.api.md`](./product-catalog/uploads.api.md)                               | Health check, collection setup, R2 presigned/direct image uploads                                                                            | #25, #26                           |
| 2   | [`brands.api.md`](./product-catalog/brands.api.md)                                 | Brand CRUD, status toggle, admin search, public list                                                                                         | #27, #33, #34                      |
| 3   | [`categories.api.md`](./product-catalog/categories.api.md)                         | Category CRUD + hierarchy, status toggle, admin search, public list/search, buyer category-product listing                                   | #28, #33, #34, #35, #36            |
| 4   | [`categorySpecifications.api.md`](./product-catalog/categorySpecifications.api.md) | Per-category specification schema (define/update/delete fields & groups)                                                                     | #29                                |
| 5   | [`categoryVariants.api.md`](./product-catalog/categoryVariants.api.md)             | Per-category variant axes (e.g. Color, Size) that drive the admin variant editor                                                             | #30                                |
| 6   | [`products.api.md`](./product-catalog/products.api.md)                             | Product CRUD, embedded variant pricing, status transitions, admin search, buyer browsing/filtering/sorting, Atlas Search filter provisioning | #31, #32, #33, #34, #35, #36, #102 |

`categories.api.md` also carries two short pointer tables ("Related Endpoints — Specifications" / "— Variant Types") that just link out to files 4 and 5 above — their real documentation lives there, not in `categories.api.md` itself.

---

### Full endpoint index

#### `uploads.api.md`

| Method | Path                         | Scope  | Doc                                                               |
| ------ | ---------------------------- | ------ | ----------------------------------------------------------------- |
| GET    | `/health`                    | public | [→](./product-catalog/uploads.api.md#get-health)                  |
| POST   | `/api/admin/uploads/presign` | admin  | [→](./product-catalog/uploads.api.md#post-apiadminuploadspresign) |
| POST   | `/api/admin/uploads/direct`  | admin  | [→](./product-catalog/uploads.api.md#post-apiadminuploadsdirect)  |

#### `brands.api.md`

| Method | Path                           | Scope  | Doc                                                               |
| ------ | ------------------------------ | ------ | ----------------------------------------------------------------- |
| POST   | `/api/admin/brands`            | admin  | [→](./product-catalog/brands.api.md#post-apiadminbrands)          |
| GET    | `/api/admin/brands`            | admin  | [→](./product-catalog/brands.api.md#get-apiadminbrands)           |
| GET    | `/api/admin/brands/:id`        | admin  | [→](./product-catalog/brands.api.md#get-apiadminbrandsid)         |
| PATCH  | `/api/admin/brands/:id`        | admin  | [→](./product-catalog/brands.api.md#patch-apiadminbrandsid)       |
| PATCH  | `/api/admin/brands/:id/status` | admin  | [→](./product-catalog/brands.api.md#patch-apiadminbrandsidstatus) |
| DELETE | `/api/admin/brands/:id`        | admin  | [→](./product-catalog/brands.api.md#delete-apiadminbrandsid)      |
| GET    | `/api/brands`                  | public | [→](./product-catalog/brands.api.md#get-apibrands)                |

#### `categories.api.md`

| Method | Path                               | Scope  | Doc                                                                       |
| ------ | ---------------------------------- | ------ | ------------------------------------------------------------------------- |
| POST   | `/api/admin/categories`            | admin  | [→](./product-catalog/categories.api.md#post-apiadmincategories)          |
| PATCH  | `/api/admin/categories/:id`        | admin  | [→](./product-catalog/categories.api.md#patch-apiadmincategoriesid)       |
| PATCH  | `/api/admin/categories/:id/status` | admin  | [→](./product-catalog/categories.api.md#patch-apiadmincategoriesidstatus) |
| GET    | `/api/admin/categories`            | admin  | [→](./product-catalog/categories.api.md#get-apiadmincategories)           |
| GET    | `/api/admin/categories/:id`        | admin  | [→](./product-catalog/categories.api.md#get-apiadmincategoriesid)         |
| DELETE | `/api/admin/categories/:id`        | admin  | [→](./product-catalog/categories.api.md#delete-apiadmincategoriesid)      |
| GET    | `/api/categories`                  | public | [→](./product-catalog/categories.api.md#get-apicategories)                |
| GET    | `/api/categories/search`           | public | [→](./product-catalog/categories.api.md#get-apicategoriessearch)          |
| GET    | `/api/categories/:slug/products`   | public | [→](./product-catalog/categories.api.md#get-apicategoriesslugproducts)    |
| GET    | `/api/categories/:slug/filters`    | public | [→](./product-catalog/categories.api.md#get-apicategoriesslugfilters)     |

#### `categorySpecifications.api.md`

| Method | Path                                       | Scope | Doc                                                                                           |
| ------ | ------------------------------------------ | ----- | --------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#get-apiadmincategoriesidspecifications)   |
| PUT    | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#put-apiadmincategoriesidspecifications)   |
| PATCH  | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#patch-apiadmincategoriesidspecifications) |

No public, status, or search surface exists for this resource — it's a schema definition, not a listable entity.

#### `categoryVariants.api.md`

| Method | Path                                      | Scope | Doc                                                                                    |
| ------ | ----------------------------------------- | ----- | -------------------------------------------------------------------------------------- |
| GET    | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#get-apiadmincategoriesidvariant-types)   |
| PUT    | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#put-apiadmincategoriesidvariant-types)   |
| PATCH  | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#patch-apiadmincategoriesidvariant-types) |

Same shape as specifications above — no public/status/search surface.

#### `products.api.md`

| Method | Path                                          | Scope  | Doc                                                                              |
| ------ | --------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| POST   | `/api/admin/products`                         | admin  | [→](./product-catalog/products.api.md#post-apiadminproducts)                     |
| PATCH  | `/api/admin/products/:id`                     | admin  | [→](./product-catalog/products.api.md#patch-apiadminproductsid)                  |
| GET    | `/api/admin/products/:id`                     | admin  | [→](./product-catalog/products.api.md#get-apiadminproductsid)                    |
| GET    | `/api/admin/products`                         | admin  | [→](./product-catalog/products.api.md#get-apiadminproducts)                      |
| DELETE | `/api/admin/products/:id`                     | admin  | [→](./product-catalog/products.api.md#delete-apiadminproductsid)                 |
| PATCH  | `/api/admin/products/:id/status`              | admin  | [→](./product-catalog/products.api.md#patch-apiadminproductsidstatus)            |
| POST   | `/api/admin/products/:id/variants`            | admin  | [→](./product-catalog/products.api.md#post-apiadminproductsidvariants)           |
| PATCH  | `/api/admin/products/:id/variants/:variantId` | admin  | [→](./product-catalog/products.api.md#patch-apiadminproductsidvariantsvariantid) |
| GET    | `/api/products`                               | public | [→](./product-catalog/products.api.md#get-apiproducts)                           |
| GET    | `/api/products/:slug`                         | public | [→](./product-catalog/products.api.md#get-apiproductsslug)                       |

`GET /api/products`'s variant-attribute (`?attributeName=`) and filterable-specification (`?spec[...]=`) filters need a MongoDB Atlas cluster (a free M0) plus a one-time `npm run search:ensure --workspace backend` to build the `products_search` index — [`products.api.md` → Testing the Atlas Search filters](./product-catalog/products.api.md#testing-the-atlas-search-filters) is the step-by-step. A standalone `?q=` keyword search needs none of that (plain regex, Issue #322). Index internals: [`../../backend/atlas-search/README.md`](../../backend/atlas-search/README.md).

---

**36 endpoints total** across the 6 files above (3 + 7 + 10 + 3 + 3 + 10 — `categories.api.md`'s two pointer tables aren't counted separately, since their real rows are already listed under `categorySpecifications.api.md`/`categoryVariants.api.md`; the count dropped by one, Issue #102, when the product-level stock-only endpoint was removed, then rose by one, Issue #326, with `GET /api/categories/:slug/filters`).

---

## Authentication

### Files, in recommended setup order

`auth.api.md` first — every other file in this folder reuses its `buyer_access_token`/`admin_access_token` collection variables:

| #   | File                                                      | Covers                                                                                                                                        | Issues                            |
| --- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | [`auth.api.md`](./authentication/auth.api.md)             | Buyer sign-in (Google One Tap, email OTP), admin sign-in (password + mandatory OTP), session (`get-session`/`sign-out`), admin password reset | #139, #140, #141, #258–#261, #264 |
| 2   | [`adminUsers.api.md`](./authentication/adminUsers.api.md) | Admin account provisioning — create/list/update further admin accounts (super-admin only)                                                     | #142                              |
| 3   | [`account.api.md`](./authentication/account.api.md)       | "My own account" — buyer profile, admin change-password, buyer dashboard                                                                       | #144, #173                        |

### Full endpoint index

#### `auth.api.md`

| Method | Path                                        | Scope         | Doc                                                                          |
| ------ | ------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| POST   | `/api/auth/email-otp/send-verification-otp` | buyer         | [→](./authentication/auth.api.md#post-apiauthemail-otpsend-verification-otp) |
| POST   | `/api/auth/sign-in/email-otp`               | buyer         | [→](./authentication/auth.api.md#post-apiauthsign-inemail-otp)               |
| POST   | `/api/auth/one-tap/callback`                | buyer         | [→](./authentication/auth.api.md#post-apiauthone-tapcallback)                |
| POST   | `/api/auth/sign-in/email`                   | admin         | [→](./authentication/auth.api.md#post-apiauthsign-inemail)                   |
| POST   | `/api/auth/two-factor/send-otp`             | admin         | [→](./authentication/auth.api.md#post-apiauthtwo-factorsend-otp)             |
| POST   | `/api/auth/two-factor/verify-otp`           | admin         | [→](./authentication/auth.api.md#post-apiauthtwo-factorverify-otp)           |
| GET    | `/api/auth/get-session`                     | buyer + admin | [→](./authentication/auth.api.md#get-apiauthget-session)                     |
| POST   | `/api/auth/sign-out`                        | buyer + admin | [→](./authentication/auth.api.md#post-apiauthsign-out)                       |
| POST   | `/api/auth/request-password-reset`          | admin         | [→](./authentication/auth.api.md#post-apiauthrequest-password-reset)         |
| POST   | `/api/auth/reset-password`                  | admin         | [→](./authentication/auth.api.md#post-apiauthreset-password)                 |

#### `adminUsers.api.md`

| Method | Path                   | Scope                    | Doc                                                           |
| ------ | ---------------------- | ------------------------ | ------------------------------------------------------------- |
| POST   | `/api/admin/users`     | admin (super-admin only) | [→](./authentication/adminUsers.api.md#post-apiadminusers)    |
| GET    | `/api/admin/users`     | admin (super-admin only) | [→](./authentication/adminUsers.api.md#get-apiadminusers)     |
| PATCH  | `/api/admin/users/:id` | admin (super-admin only) | [→](./authentication/adminUsers.api.md#patch-apiadminusersid) |

#### `account.api.md`

| Method | Path                           | Scope            | Doc                                                                 |
| ------ | ------------------------------ | ---------------- | ------------------------------------------------------------------- |
| GET    | `/api/account/profile`         | buyer            | [→](./authentication/account.api.md#get-apiaccountprofile)          |
| PATCH  | `/api/account/profile`         | buyer            | [→](./authentication/account.api.md#patch-apiaccountprofile)        |
| POST   | `/api/account/change-password` | admin (any role) | [→](./authentication/account.api.md#post-apiaccountchange-password) |
| GET    | `/api/account/dashboard`       | buyer            | [→](./authentication/account.api.md#get-apiaccountdashboard)        |

---

**17 endpoints total** across the 3 files above (10 + 3 + 4). The full-page Google OAuth redirect flow (`POST /api/auth/sign-in/social` + `GET /api/auth/callback/google`) was **not** rebuilt on the custom session engine (Issues #258/#260) — those two paths now return 404; One Tap and email OTP are the buyer sign-in methods. Google One Tap's `idToken` still can't be fabricated by hand — see [`auth.api.md`](./authentication/auth.api.md#post-apiauthone-tapcallback).

---

## Shopping Cart

### Files

| #   | File                                         | Covers                                                                                              | Issues     |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| 1   | [`cart.api.md`](./shopping-cart/cart.api.md) | Buyer cart — retrieve/add/update-quantity/remove-line/clear, live pricing & availability resolution | #150, #151 |

Needs a `buyer_access_token` (from [`authentication/auth.api.md`](./authentication/auth.api.md)'s buyer sign-in) and at least one published product with an active variant.

### Full endpoint index

#### `cart.api.md`

| Method | Path                         | Scope | Doc                                                           |
| ------ | ---------------------------- | ----- | ------------------------------------------------------------- |
| GET    | `/api/cart`                  | buyer | [→](./shopping-cart/cart.api.md#get-apicart)                  |
| POST   | `/api/cart/items`            | buyer | [→](./shopping-cart/cart.api.md#post-apicartitems)            |
| PATCH  | `/api/cart/items/:variantId` | buyer | [→](./shopping-cart/cart.api.md#patch-apicartitemsvariantid)  |
| DELETE | `/api/cart/items/:variantId` | buyer | [→](./shopping-cart/cart.api.md#delete-apicartitemsvariantid) |
| DELETE | `/api/cart`                  | buyer | [→](./shopping-cart/cart.api.md#delete-apicart)               |

**5 endpoints**, all buyer-session-only — no admin surface (SRS v0.4 §7). `POST`/`PATCH .../items` can also return a `409 INSUFFICIENT_STOCK` (Issue #190/M10.2) — see [`cart.api.md`](./shopping-cart/cart.api.md#error-code-reference).

---

## Order Management

### Files, in recommended setup order

Needs a `buyer_access_token` for the buyer-facing files and an `admin_access_token` (as `order-manager`/`super-admin`) for the admin one — both from [`authentication/auth.api.md`](./authentication/auth.api.md). Address book first, since checkout can reference a saved address:

| #   | File                                                          | Covers                                                                                  | Issues     |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- |
| 1   | [`addresses.api.md`](./order-management/addresses.api.md)     | Buyer address book — create/list/update/delete, set-default                              | #154       |
| 2   | [`orders.api.md`](./order-management/orders.api.md)           | Buyer checkout, order history/detail, self-cancel; the order status lifecycle reference   | #155–#157  |
| 3   | [`ordersAdmin.api.md`](./order-management/ordersAdmin.api.md) | Admin order list/detail, status advance, admin-cancel                                    | #158       |

`orders.api.md`/`ordersAdmin.api.md` each carry a pointer table to [`payments/payments.api.md`](./payments/payments.api.md) for the payment/refund endpoints wired onto their routers.

### Full endpoint index

#### `addresses.api.md`

| Method | Path                          | Scope | Doc                                                                     |
| ------ | ----------------------------- | ----- | -------------------------------------------------------------------------- |
| GET    | `/api/addresses`              | buyer | [→](./order-management/addresses.api.md#get-apiaddresses)                |
| POST   | `/api/addresses`              | buyer | [→](./order-management/addresses.api.md#post-apiaddresses)               |
| PATCH  | `/api/addresses/:id`          | buyer | [→](./order-management/addresses.api.md#patch-apiaddressesid)            |
| DELETE | `/api/addresses/:id`          | buyer | [→](./order-management/addresses.api.md#delete-apiaddressesid)           |
| PATCH  | `/api/addresses/:id/default`  | buyer | [→](./order-management/addresses.api.md#patch-apiaddressesiddefault)     |

#### `orders.api.md`

| Method | Path                     | Scope | Doc                                                          |
| ------ | ------------------------ | ----- | -------------------------------------------------------------- |
| POST   | `/api/orders`            | buyer | [→](./order-management/orders.api.md#post-apiorders)          |
| GET    | `/api/orders`            | buyer | [→](./order-management/orders.api.md#get-apiorders)           |
| GET    | `/api/orders/:id`        | buyer | [→](./order-management/orders.api.md#get-apiordersid)         |
| POST   | `/api/orders/:id/cancel` | buyer | [→](./order-management/orders.api.md#post-apiordersidcancel)  |

#### `ordersAdmin.api.md`

| Method | Path                              | Scope | Doc                                                                          |
| ------ | ---------------------------------- | ----- | --------------------------------------------------------------------------------- |
| GET    | `/api/admin/orders`               | admin | [→](./order-management/ordersAdmin.api.md#get-apiadminorders)                    |
| GET    | `/api/admin/orders/:id`           | admin | [→](./order-management/ordersAdmin.api.md#get-apiadminordersid)                  |
| PATCH  | `/api/admin/orders/:id/status`    | admin | [→](./order-management/ordersAdmin.api.md#patch-apiadminordersidstatus)          |
| POST   | `/api/admin/orders/:id/cancel`    | admin | [→](./order-management/ordersAdmin.api.md#post-apiadminordersidcancel)           |

---

**13 endpoints total** across the 3 files above (5 + 4 + 4). The two payment endpoints wired onto `orders.api.md`'s router and the refund endpoint wired onto `ordersAdmin.api.md`'s router are counted under Payments below, not here.

---

## Payments

### Files, in recommended setup order

Needs a `buyer_access_token` for initiate/verify and an `admin_access_token` (`order-manager`/`super-admin`) for refund, both from [`authentication/auth.api.md`](./authentication/auth.api.md), plus an order in `pending_payment` status from [`order-management/orders.api.md`](./order-management/orders.api.md). Built and verified against dummy Razorpay test credentials:

| #   | File                                          | Covers                                                                        | Issues            |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------ |
| 1   | [`payments.api.md`](./payments/payments.api.md) | Mint a Razorpay order, verify the Checkout widget callback, admin full/partial refund | #164, #165, #167  |
| 2   | [`webhooks.api.md`](./payments/webhooks.api.md) | The async Razorpay webhook — signature-authenticated, idempotent                    | #166              |

Note the **paise** unit boundary — `payments.amount`/`refunds[].amount` are the only paise-denominated fields anywhere in this API; every other money field in this whole index is whole rupees.

### Full endpoint index

#### `payments.api.md`

| Method | Path                                | Scope | Doc                                                           |
| ------ | ------------------------------------ | ----- | ------------------------------------------------------------- |
| POST   | `/api/orders/:id/payment`           | buyer | [→](./payments/payments.api.md#post-apiordersidpayment)      |
| POST   | `/api/orders/:id/payment/verify`    | buyer | [→](./payments/payments.api.md#post-apiordersidpaymentverify) |
| POST   | `/api/admin/orders/:id/refund`      | admin | [→](./payments/payments.api.md#post-apiadminordersidrefund)  |

#### `webhooks.api.md`

| Method | Path                       | Scope             | Doc                                                    |
| ------ | -------------------------- | ------------------ | --------------------------------------------------------- |
| POST   | `/api/webhooks/razorpay`  | signature-auth only | [→](./payments/webhooks.api.md#post-apiwebhooksrazorpay) |

---

**4 endpoints total** across the 2 files above (3 + 1).

---

## Dashboard

### Files

Needs an `admin_access_token` from [`authentication/auth.api.md`](./authentication/auth.api.md) — `order-manager`/`super-admin` for `summary`/`sales`/`top-products`, `catalog-manager`/`super-admin` for `catalog-summary` (a deliberate reciprocal role split, not a typo). The separate buyer-facing dashboard lives in [`authentication/account.api.md`](./authentication/account.api.md#get-apiaccountdashboard), not here:

| #   | File                                             | Covers                                                                                  | Issues     |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- |
| 1   | [`dashboard.api.md`](./dashboard/dashboard.api.md) | Admin sales summary/over-time/top-products, catalog summary — all read-only aggregations | #171, #172 |

### Full endpoint index

#### `dashboard.api.md`

| Method | Path                                        | Scope             | Doc                                                              |
| ------ | -------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| GET    | `/api/admin/dashboard/summary`             | admin (order-manager) | [→](./dashboard/dashboard.api.md#get-apiadmindashboardsummary)      |
| GET    | `/api/admin/dashboard/sales`               | admin (order-manager) | [→](./dashboard/dashboard.api.md#get-apiadmindashboardsales)        |
| GET    | `/api/admin/dashboard/top-products`        | admin (order-manager) | [→](./dashboard/dashboard.api.md#get-apiadmindashboardtop-products) |
| GET    | `/api/admin/dashboard/catalog-summary`     | admin (catalog-manager) | [→](./dashboard/dashboard.api.md#get-apiadmindashboardcatalog-summary) |

---

**4 endpoints total.** The buyer's own `GET /api/account/dashboard` is a fifth dashboard-shaped read, but is counted under Authentication above since it lives in that module's file.

---

## Inventory

### Files, in recommended setup order

Needs an `admin_access_token` (`catalog-manager`/`super-admin`) from [`authentication/auth.api.md`](./authentication/auth.api.md). Warehouses first, since inventory rows reference them:

| #   | File                                                | Covers                                                          | Issues |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------- | ------ |
| 1   | [`warehouses.api.md`](./inventory/warehouses.api.md) | Warehouse create + list only — no edit/delete/status endpoint exists | #189   |
| 2   | [`inventory.api.md`](./inventory/inventory.api.md)   | Per-`(variant, warehouse)` stock rows — list + stock-only update    | #189   |

### Full endpoint index

#### `warehouses.api.md`

| Method | Path                       | Scope | Doc                                                              |
| ------ | --------------------------- | ----- | --------------------------------------------------------------------- |
| POST   | `/api/admin/warehouses`   | admin | [→](./inventory/warehouses.api.md#post-apiadminwarehouses)           |
| GET    | `/api/admin/warehouses`   | admin | [→](./inventory/warehouses.api.md#get-apiadminwarehouses)            |

#### `inventory.api.md`

| Method | Path                                | Scope | Doc                                                                |
| ------ | ------------------------------------- | ----- | ----------------------------------------------------------------------- |
| GET    | `/api/admin/inventory`               | admin | [→](./inventory/inventory.api.md#get-apiadmininventory)                |
| PATCH  | `/api/admin/inventory/:inventoryId`  | admin | [→](./inventory/inventory.api.md#patch-apiadmininventoryinventoryid)   |

---

**4 endpoints total** across the 2 files above (2 + 2), both `catalog-manager`/`super-admin`-gated. Buyer-facing stock visibility (`availability`, `?inStock=true`) is documented in [`product-catalog/products.api.md`](./product-catalog/products.api.md), not here — this section is admin-only stock management.
