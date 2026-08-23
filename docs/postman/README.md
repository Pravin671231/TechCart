# TechCart Backend API — Postman Manuals Index

This folder is a set of hand-written, step-by-step guides for testing TechCart's backend API by hand in Postman — one file per backend module, each with request/response examples and error cases. It is **not** an exported Postman collection JSON file; there is no `.postman_collection.json` to import here, just markdown walkthroughs.

Before opening any file below, do the one-time collection setup (`base_url`/`admin_api_key` variables) described in [`product-catalog/uploads.api.md`](./product-catalog/uploads.api.md#one-time-postman-setup) — every other doc in this folder assumes that setup is already done and just reuses the same collection. [`authentication/auth.api.md`](./authentication/auth.api.md#one-time-postman-setup) adds two further collection variables (`buyer_access_token`/`admin_access_token`) on top of that, needed by every other file in its own folder.

This index covers two domains: M2 (Product Catalog) — Issues #25 through #36, plus Issue #102 (SRS v0.2 amendment: variant-only pricing, stock/inventory tracking removed) and Issue #104 (SRS v0.2 amendment: shared admin list pagination/sort) — and M3 (Authentication) — Issues #139 (buyer sign-in), #140 (admin sign-in), #141 (admin password reset), #142 (admin account provisioning), and #144 (account self-service).

**A known, documented gap, not something to "fix" while reading `product-catalog/`:** every `product-catalog/*.api.md` file still documents the admin routes as guarded by the placeholder `X-Admin-Key` header — accurate when those docs were written (through Issue #34/M2.10), but Issue #143/M3.5 replaced that guard with real session+role authentication (`src/middleware/rbac.ts`) for every one of those routes. The `product-catalog/` docs haven't been updated to reflect that yet; a real request against `/api/admin/brands`, `/api/admin/categories`, etc. today needs `Authorization: Bearer <token>` from [`authentication/auth.api.md`](./authentication/auth.api.md)'s admin sign-in flow, not `X-Admin-Key`. Tracked as a follow-up, out of scope for the Authentication docs added here (Issue #224).

---

## Conventions for New Endpoints

Two standing rules for this folder, in effect from Issue #224 onward:

1. **Every backend API endpoint created or updated — in any feature, not just Authentication — must have its `docs/postman/<feature>/*.api.md` walkthrough created or updated in the same PR.** No endpoint ships without a matching Postman doc.
2. **Every `docs/postman/<feature>/` folder follows `product-catalog/`'s structure exactly**: one `.api.md` file per backend module, a per-file endpoint table, and a `docs/postman/README.md` index entry (both a files-table row and a full-endpoint-index row) — no ad hoc layout or naming per feature.

---

## Product Catalog

### Files, in recommended setup order

A product can't exist without a brand and a category first, so work through these roughly in order the first time:

| # | File | Covers | Issues |
| - | ---- | ------ | ------ |
| 1 | [`uploads.api.md`](./product-catalog/uploads.api.md) | Health check, collection setup, R2 presigned/direct image uploads | #25, #26 |
| 2 | [`brands.api.md`](./product-catalog/brands.api.md) | Brand CRUD, status toggle, admin search, public list | #27, #33, #34 |
| 3 | [`categories.api.md`](./product-catalog/categories.api.md) | Category CRUD + hierarchy, status toggle, admin search, public list/search, buyer category-product listing | #28, #33, #34, #35, #36 |
| 4 | [`categorySpecifications.api.md`](./product-catalog/categorySpecifications.api.md) | Per-category specification schema (define/update/delete fields & groups) | #29 |
| 5 | [`categoryVariants.api.md`](./product-catalog/categoryVariants.api.md) | Per-category variant axes (e.g. Color, Size) that drive the admin variant editor | #30 |
| 6 | [`products.api.md`](./product-catalog/products.api.md) | Product CRUD, embedded variant pricing, status transitions, admin search, buyer browsing/filtering/sorting | #31, #32, #33, #34, #35, #36, #102 |

`categories.api.md` also carries two short pointer tables ("Related Endpoints — Specifications" / "— Variant Types") that just link out to files 4 and 5 above — their real documentation lives there, not in `categories.api.md` itself.

---

### Full endpoint index

#### `uploads.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| GET | `/health` | public | [→](./product-catalog/uploads.api.md#get-health) |
| POST | `/api/admin/uploads/presign` | admin | [→](./product-catalog/uploads.api.md#post-apiadminuploadspresign) |
| POST | `/api/admin/uploads/direct` | admin | [→](./product-catalog/uploads.api.md#post-apiadminuploadsdirect) |

#### `brands.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| POST | `/api/admin/brands` | admin | [→](./product-catalog/brands.api.md#post-apiadminbrands) |
| GET | `/api/admin/brands` | admin | [→](./product-catalog/brands.api.md#get-apiadminbrands) |
| GET | `/api/admin/brands/:id` | admin | [→](./product-catalog/brands.api.md#get-apiadminbrandsid) |
| PATCH | `/api/admin/brands/:id` | admin | [→](./product-catalog/brands.api.md#patch-apiadminbrandsid) |
| PATCH | `/api/admin/brands/:id/status` | admin | [→](./product-catalog/brands.api.md#patch-apiadminbrandsidstatus) |
| DELETE | `/api/admin/brands/:id` | admin | [→](./product-catalog/brands.api.md#delete-apiadminbrandsid) |
| GET | `/api/brands` | public | [→](./product-catalog/brands.api.md#get-apibrands) |

#### `categories.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| POST | `/api/admin/categories` | admin | [→](./product-catalog/categories.api.md#post-apiadmincategories) |
| PATCH | `/api/admin/categories/:id` | admin | [→](./product-catalog/categories.api.md#patch-apiadmincategoriesid) |
| PATCH | `/api/admin/categories/:id/status` | admin | [→](./product-catalog/categories.api.md#patch-apiadmincategoriesidstatus) |
| GET | `/api/admin/categories` | admin | [→](./product-catalog/categories.api.md#get-apiadmincategories) |
| GET | `/api/admin/categories/:id` | admin | [→](./product-catalog/categories.api.md#get-apiadmincategoriesid) |
| DELETE | `/api/admin/categories/:id` | admin | [→](./product-catalog/categories.api.md#delete-apiadmincategoriesid) |
| GET | `/api/categories` | public | [→](./product-catalog/categories.api.md#get-apicategories) |
| GET | `/api/categories/search` | public | [→](./product-catalog/categories.api.md#get-apicategoriessearch) |
| GET | `/api/categories/:slug/products` | public | [→](./product-catalog/categories.api.md#get-apicategoriesslugproducts) |

#### `categorySpecifications.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| GET | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#get-apiadmincategoriesidspecifications) |
| PUT | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#put-apiadmincategoriesidspecifications) |
| PATCH | `/api/admin/categories/:id/specifications` | admin | [→](./product-catalog/categorySpecifications.api.md#patch-apiadmincategoriesidspecifications) |

No public, status, or search surface exists for this resource — it's a schema definition, not a listable entity.

#### `categoryVariants.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| GET | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#get-apiadmincategoriesidvariant-types) |
| PUT | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#put-apiadmincategoriesidvariant-types) |
| PATCH | `/api/admin/categories/:id/variant-types` | admin | [→](./product-catalog/categoryVariants.api.md#patch-apiadmincategoriesidvariant-types) |

Same shape as specifications above — no public/status/search surface.

#### `products.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| POST | `/api/admin/products` | admin | [→](./product-catalog/products.api.md#post-apiadminproducts) |
| PATCH | `/api/admin/products/:id` | admin | [→](./product-catalog/products.api.md#patch-apiadminproductsid) |
| GET | `/api/admin/products/:id` | admin | [→](./product-catalog/products.api.md#get-apiadminproductsid) |
| GET | `/api/admin/products` | admin | [→](./product-catalog/products.api.md#get-apiadminproducts) |
| DELETE | `/api/admin/products/:id` | admin | [→](./product-catalog/products.api.md#delete-apiadminproductsid) |
| PATCH | `/api/admin/products/:id/status` | admin | [→](./product-catalog/products.api.md#patch-apiadminproductsidstatus) |
| POST | `/api/admin/products/:id/variants` | admin | [→](./product-catalog/products.api.md#post-apiadminproductsidvariants) |
| PATCH | `/api/admin/products/:id/variants/:variantId` | admin | [→](./product-catalog/products.api.md#patch-apiadminproductsidvariantsvariantid) |
| GET | `/api/products` | public | [→](./product-catalog/products.api.md#get-apiproducts) |
| GET | `/api/products/:slug` | public | [→](./product-catalog/products.api.md#get-apiproductsslug) |

`GET /api/products?q=` and its variant-attribute/specification filters depend on a MongoDB Atlas Search index this repo can't provision for you locally — see [`../../backend/atlas-search/README.md`](../../backend/atlas-search/README.md) before testing those specifically.

---

**35 endpoints total** across the 6 files above (3 + 7 + 9 + 3 + 3 + 10 — `categories.api.md`'s two pointer tables aren't counted separately, since their real rows are already listed under `categorySpecifications.api.md`/`categoryVariants.api.md`; the count dropped by one, Issue #102, when the product-level stock-only endpoint was removed).

---

## Authentication

### Files, in recommended setup order

`auth.api.md` first — every other file in this folder reuses its `buyer_access_token`/`admin_access_token` collection variables:

| # | File | Covers | Issues |
| - | ---- | ------ | ------ |
| 1 | [`auth.api.md`](./authentication/auth.api.md) | Buyer sign-in (Google One Tap/OAuth, email OTP), admin sign-in (password + mandatory OTP), session (`get-session`/`sign-out`), admin password reset | #139, #140, #141 |
| 2 | [`adminUsers.api.md`](./authentication/adminUsers.api.md) | Admin account provisioning — create/list/update further admin accounts (super-admin only) | #142 |
| 3 | [`account.api.md`](./authentication/account.api.md) | "My own account" — buyer profile, admin change-password | #144 |

### Full endpoint index

#### `auth.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| POST | `/api/auth/email-otp/send-verification-otp` | buyer | [→](./authentication/auth.api.md#post-apiauthemail-otpsend-verification-otp) |
| POST | `/api/auth/sign-in/email-otp` | buyer | [→](./authentication/auth.api.md#post-apiauthsign-inemail-otp) |
| POST | `/api/auth/one-tap/callback` | buyer | [→](./authentication/auth.api.md#post-apiauthone-tapcallback) |
| POST | `/api/auth/sign-in/social` | buyer | [→](./authentication/auth.api.md#post-apiauthsign-insocial--get-apiauthcallbackgoogle) |
| GET | `/api/auth/callback/google` | buyer | [→](./authentication/auth.api.md#post-apiauthsign-insocial--get-apiauthcallbackgoogle) |
| POST | `/api/auth/sign-in/email` | admin | [→](./authentication/auth.api.md#post-apiauthsign-inemail) |
| POST | `/api/auth/two-factor/send-otp` | admin | [→](./authentication/auth.api.md#post-apiauthtwo-factorsend-otp) |
| POST | `/api/auth/two-factor/verify-otp` | admin | [→](./authentication/auth.api.md#post-apiauthtwo-factorverify-otp) |
| GET | `/api/auth/get-session` | buyer + admin | [→](./authentication/auth.api.md#get-apiauthget-session) |
| POST | `/api/auth/sign-out` | buyer + admin | [→](./authentication/auth.api.md#post-apiauthsign-out) |
| POST | `/api/auth/request-password-reset` | admin | [→](./authentication/auth.api.md#post-apiauthrequest-password-reset) |
| POST | `/api/auth/reset-password` | admin | [→](./authentication/auth.api.md#post-apiauthreset-password) |

#### `adminUsers.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| POST | `/api/admin/users` | admin (super-admin only) | [→](./authentication/adminUsers.api.md#post-apiadminusers) |
| GET | `/api/admin/users` | admin (super-admin only) | [→](./authentication/adminUsers.api.md#get-apiadminusers) |
| PATCH | `/api/admin/users/:id` | admin (super-admin only) | [→](./authentication/adminUsers.api.md#patch-apiadminusersid) |

#### `account.api.md`

| Method | Path | Scope | Doc |
| ------ | ---- | ----- | --- |
| GET | `/api/account/profile` | buyer | [→](./authentication/account.api.md#get-apiaccountprofile) |
| PATCH | `/api/account/profile` | buyer | [→](./authentication/account.api.md#patch-apiaccountprofile) |
| POST | `/api/account/change-password` | admin (any role) | [→](./authentication/account.api.md#post-apiaccountchange-password) |

---

**18 endpoints total** across the 3 files above (12 + 3 + 3). Google OAuth's two-call flow (`POST /api/auth/sign-in/social` + `GET /api/auth/callback/google`) is a real browser-redirect sequence Postman can't complete end-to-end on its own — see [`auth.api.md`](./authentication/auth.api.md#post-apiauthsign-insocial--get-apiauthcallbackgoogle) for what that means for testing it by hand.
