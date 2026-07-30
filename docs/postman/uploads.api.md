# Postman Manual — TechCart Backend API (Uploads)

A step-by-step guide to testing the current TechCart backend API using Postman.

**Scope:** this document covers what's actually implemented as of Issue #26 (M2.2 — Cloudflare R2 image uploads): the `GET /health` check and the two upload endpoints, `POST /api/admin/uploads/presign` and `POST /api/admin/uploads/direct` (SRS amendment `FR-CAT-097`–`100`). There is no login/session system yet — admin routes are gated by a single static `X-Admin-Key` header (`FR-CAT-088`–`090`), a placeholder until SRS v0.3 ships real authentication. Categories, products, and every buyer-facing endpoint (besides the brand list) are separate, not-yet-implemented issues (#28–#36) — see [What's Not Here Yet](#whats-not-here-yet). Brand management (`#27`) has its own file, [`brands.api.md`](./brands.api.md); later endpoint groups (`categories.api.md`, ...) get their own file alongside this one as they land.

---

## Prerequisites

Before opening Postman, make sure:

1. **Backend is running**

   ```
   npm run dev --workspace backend
   ```

   You should see `Server is running on port 4000` in the terminal (the default `PORT` in `backend/.env.example`).

2. **`.env` is filled in.** Copy `backend/.env.example` to `backend/.env` and set:
   ```
   PORT=4000
   NODE_ENV=development
   MONGODB_URI=<your MongoDB Atlas or local connection string>
   ADMIN_API_KEY=<any string you choose — this is what you'll paste into Postman>
   R2_ACCOUNT_ID=<Cloudflare account ID>
   R2_ACCESS_KEY_ID=<R2 API token access key ID>
   R2_SECRET_ACCESS_KEY=<R2 API token secret>
   R2_BUCKET_NAME=<your R2 bucket name>
   R2_PUBLIC_URL_BASE=<the bucket's public URL — a custom domain or the r2.dev URL>
   ```
   All nine are required — `src/config/env.ts` validates them with `zod` at startup and refuses to boot if any are missing. The five `R2_*` values need a **real Cloudflare R2 account** for the presign endpoint to issue a URL that actually works; without one, `POST /presign` will 500 (the AWS SDK will fail to reach a real R2 endpoint), not silently succeed.

---

## One-Time Postman Setup

Do this once before testing anything.

### 1. Create a Collection

1. Open Postman → **Collections** → **+** (New Collection)
2. Name it: `TechCart Backend API`

### 2. Add Collection Variables

Click the collection name → **Variables** tab → add:

| Variable        | Initial Value           | Current Value                        |
| --------------- | ----------------------- | ------------------------------------ |
| `base_url`      | `http://localhost:4000` | `http://localhost:4000`              |
| `admin_api_key` | _(leave empty)_         | _(paste your `ADMIN_API_KEY` value)_ |

Click **Save**. There's no `access_token`/`otp_session_id` to manage here — unlike a login-based API, `admin_api_key` is a static value you set once and never refresh.

---

## `GET /health`

Public — no headers required. Useful as a first request to confirm the server is actually up before testing anything else.

| Field  | Value                 |
| ------ | --------------------- |
| Method | `GET`                 |
| URL    | `{{base_url}}/health` |
| Name   | `Health Check`        |

No headers, no body. **Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "code": "OK",
  "message": "healthy"
}
```

Note this shape (`{ success, code, message }`) is different from every other endpoint's success shape — `health` predates the `{ success, data }` envelope (introduced in Issue #25) and was deliberately left as-is since it isn't a catalog resource.

**Unmatched route** (any path that doesn't exist, e.g. `GET {{base_url}}/nope`) returns:

```json
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Route not found"
}
```

---

## `POST /api/admin/uploads/presign`

The one real admin endpoint right now. Issues a short-lived presigned URL for uploading one image directly to Cloudflare R2 — the backend never receives the image bytes itself (`FR-CAT-077`).

| Field  | Value                                    |
| ------ | ---------------------------------------- |
| Method | `POST`                                   |
| URL    | `{{base_url}}/api/admin/uploads/presign` |
| Name   | `Presign Upload`                         |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
Content-Type: application/json
```

**Body tab → raw → JSON:**

```json
{
  "purpose": "product-image",
  "contentType": "image/webp"
}
```

- `purpose` — one of `"product-image"`, `"brand-logo"`, `"category-image"`. Determines the object key's prefix.
- `contentType` — one of `"image/jpeg"`, `"image/png"`, `"image/webp"`. Anything else is rejected before any URL is issued (`FR-CAT-078`).

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://<bucket>.<account-id>.r2.cloudflarestorage.com/product-image%2F...?X-Amz-Signature=...",
    "objectKey": "product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
    "publicUrl": "https://cdn.example.com/product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
    "expiresAt": "2026-07-28T12:05:00.000Z"
  }
}
```

- `objectKey` always matches `{purpose}/{uuid}.{ext}` — server-generated, never derived from the client's request beyond `purpose`/`contentType` (`FR-CAT-079`). The client cannot choose or influence it.
- `uploadUrl` expires **5 minutes** after issuance (`FR-CAT-080`) — upload to it with a `PUT` request (raw binary body, matching `Content-Type` header) before then. Testing that R2 actually rejects it after 5 minutes requires a real R2 account; this can't be simulated locally.
- `publicUrl` is where the file will be reachable once uploaded — built from your `R2_PUBLIC_URL_BASE` + the object key. This is the URL that would eventually get stored as an `images[].url` on a product/brand/category, once those endpoints exist (#27, #28, #31).
- No `pagination` key — this is a detail-shaped response, not a list.

### Error cases

**Missing `X-Admin-Key` header:**

```
401 Unauthorized
```

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "Missing or invalid admin credentials"
}
```

**Wrong `X-Admin-Key` value:** identical response to the missing-header case above.

**Invalid `purpose`** (e.g. `"purpose": "banner-image"`):

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "purpose": "Invalid option: expected one of \"product-image\"|\"brand-logo\"|\"category-image\""
  }
}
```

**Disallowed `contentType`** (e.g. `"contentType": "image/gif"`):

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "contentType": "Invalid option: expected one of \"image/jpeg\"|\"image/png\"|\"image/webp\""
  }
}
```

---

## `POST /api/admin/uploads/direct`

A second upload path for clients that can't perform a direct browser-to-R2 `PUT` (server-side tooling, scripts, classic form submission). Unlike `/presign`, the file itself is sent to the backend as `multipart/form-data`, parsed in memory by `multer`, and uploaded to R2 server-side — the one deliberate exception to `FR-CAT-077`'s "backend never receives raw image bytes" (`FR-CAT-097`).

| Field  | Value                                   |
| ------ | --------------------------------------- |
| Method | `POST`                                  |
| URL    | `{{base_url}}/api/admin/uploads/direct` |
| Name   | `Direct Upload`                         |

**Headers tab:**

```
X-Admin-Key: {{admin_api_key}}
```

Do **not** set `Content-Type` manually here — Postman sets `multipart/form-data; boundary=...` automatically once you use the form-data body type below.

**Body tab → form-data:**

| Key       | Type | Value                                                  |
| --------- | ---- | ------------------------------------------------------ |
| `purpose` | Text | one of `product-image`, `brand-logo`, `category-image` |
| `file`    | File | pick a real `.jpg`/`.png`/`.webp` file (max 5 MB)      |

- `purpose` — same enum and meaning as the presign endpoint.
- `file` — the field name **must** be `file`; `multer`'s `upload.single("file")` only looks for that field name. Anything else attached is ignored.
- Max size is **5 MB** (`FR-CAT-098`) — larger files are rejected before any R2 call, not truncated.
- Allowed content types are the same allow-list as presign (`image/jpeg`, `image/png`, `image/webp`), checked against the file's actual `mimetype`, not its extension.

**Click Send. Expected response — `200 OK`:**

```json
{
  "success": true,
  "data": {
    "objectKey": "product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
    "publicUrl": "https://cdn.example.com/product-image/1b9d3c4e-2f7a-4b8e-9c1d-6a5f8e2d4c3b.webp",
    "expiresAt": "2026-07-29T00:05:00.000Z"
  }
}
```

- No `uploadUrl` in this response — unlike `/presign`, the file is already uploaded by the time you get a response; there's nothing left for the client to `PUT`.
- `objectKey` and `publicUrl` follow the exact same format as the presign response (`FR-CAT-099`). Once brand/category/product registration exists (#27, #28, #31), a key issued here is consumed identically to a presigned one — the registration endpoint can't tell which path produced it.

### Error cases

**Missing `X-Admin-Key` header:** identical `401 UNAUTHORIZED` response as `/presign`.

**Invalid `purpose`:** identical `400 VALIDATION_ERROR` shape as `/presign`, keyed on `purpose`.

**No `file` attached:**

```
400 Bad Request
```

```json
{
  "success": false,
  "code": "NO_FILE_UPLOADED",
  "message": "No file was uploaded under the \"file\" field."
}
```

**Disallowed file content type** (e.g. uploading a `.gif`):

```json
{
  "success": false,
  "code": "UNSUPPORTED_CONTENT_TYPE",
  "message": "Content type \"image/gif\" is not one of the allowed image types."
}
```

**File over 5 MB:**

```json
{
  "success": false,
  "code": "FILE_TOO_LARGE",
  "message": "File too large"
}
```

---

## Error Code Reference

Every code below was found by grepping every `AppError(...)`/error-producing call site in the backend — nothing here is speculative.

| Code                        | Status | Where it comes from                                                                                                       | Reachable via an existing endpoint?                                                                                                                                 |
| --------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHORIZED`              | 401    | `adminAuth.ts` — missing/wrong `X-Admin-Key`                                                                              | Yes                                                                                                                                                                 |
| `VALIDATION_ERROR`          | 400    | `errorHandler.ts` — a thrown `ZodError` (e.g. bad `purpose`/`contentType`), reported as an `errors` object keyed by field | Yes                                                                                                                                                                 |
| `NOT_FOUND`                 | 404    | `notFound.ts` — unmatched route                                                                                           | Yes                                                                                                                                                                 |
| `INTERNAL_ERROR`            | 500    | `errorHandler.ts` — fallback for anything unrecognized                                                                    | Yes, but not triggered in normal use                                                                                                                                |
| `OBJECT_KEY_NOT_ISSUED`     | 400    | `uploads.service.ts`'s `consumeImageKeys()` — a key that was never issued or is already consumed                          | **Not yet** — this function exists but isn't wired to any route yet; it will be called internally once #27/#28/#31 (brand/category/product create-and-update) exist |
| `IMAGE_COUNT_OUT_OF_BOUNDS` | 400    | `uploads.service.ts`'s `validateImageCount()` — image array outside its allowed bounds                                    | **Not yet** — same as above                                                                                                                                         |
| `NO_FILE_UPLOADED`          | 400    | `uploads.controller.ts`'s `directUpload()` — `POST /direct` called with no `file` field attached                          | Yes                                                                                                                                                                 |
| `UNSUPPORTED_CONTENT_TYPE`  | 400    | `uploads.controller.ts`'s `directUpload()` — attached file's `mimetype` isn't JPEG/PNG/WebP                               | Yes                                                                                                                                                                 |
| `FILE_TOO_LARGE`            | 400    | `errorHandler.ts` — a thrown `MulterError` with code `LIMIT_FILE_SIZE` (file over `MAX_DIRECT_UPLOAD_BYTES`, 5 MB)        | Yes                                                                                                                                                                 |
| `UPLOAD_ERROR`              | 400    | `errorHandler.ts` — any other thrown `MulterError` (e.g. malformed multipart body)                                        | Only via a malformed request — not triggered by normal Postman use                                                                                                  |

The last two are listed for completeness rather than omitted — they're real code paths in this codebase, just not reachable through any HTTP request today.

---

## Understanding Validation Errors

When a request fails schema validation, `errorHandler.ts` returns an `errors` object — one key per failing field, value is that field's own reason. There is no `message` key on a `VALIDATION_ERROR` response:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": {
    "purpose": "Invalid option: expected one of \"product-image\"|\"brand-logo\"|\"category-image\"",
    "contentType": "Invalid option: expected one of \"image/jpeg\"|\"image/png\"|\"image/webp\""
  }
}
```

(this example shows `purpose` missing entirely and `contentType` set to `"image/gif"` in the same request — Zod's enum validator reports a missing value the same way it reports an invalid one, since `undefined` doesn't match any allowed option either.)

Fix the named field(s) in your request body — the `errors` object's keys tell you exactly which ones — and try again.

---

## What's Not Here Yet

This document is a snapshot of Issues #25 (core plumbing) and #26 (R2 uploads) — not the full Product Catalog API. Brand management (`#27`) is now covered in [`brands.api.md`](./brands.api.md). Not yet implemented, each its own future issue:

- Category management (`#28`)
- Category-governed specifications (`#29`) and variant types (`#30`)
- Product core CRUD (`#31`) and product variants (`#32`)
- Status update APIs (`#33`)
- Admin search (`#34`)
- Buyer browsing/search/inventory visibility (`#35`)
- Buyer filtering, sorting, and card content (`#36`)

No real authentication exists yet either (v0.3) — the `X-Admin-Key` header is explicitly a temporary placeholder, not a long-term design.
