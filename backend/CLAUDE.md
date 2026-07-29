# CLAUDE.md (backend)

This file covers `backend/` implementation detail only. Root-level architecture decisions live in the root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those.

## Current status

Module-based skeleton scaffolded (Issue #2 / M0.2): Express 5 + TypeScript, cross-cutting `src/config/`, `src/middleware/`, `src/utils/`, `src/externalService/`, `src/routes/` (aggregator), and one feature module, `src/modules/health/`. Vitest + Supertest are wired with passing tests. `npm run build|dev|test --workspace backend` all work. M2 core plumbing is in place (Issue #25 / M2.1): `src/config/db.ts` holds a live Mongoose connection (plus `disconnectDB()` for graceful shutdown), started from `src/index.ts`'s exported `startServer()` (refuses to call `app.listen()` and exits `1` if `connectDB()` rejects — see Startup below); `src/config/env.ts` validates `process.env` with a `zod` schema (first `zod` usage in this workspace); `src/utils/apiResponse.ts`'s `successResponse()` is the shared `{ success: true, data }` (+ optional `pagination`) envelope every later catalog controller uses; `src/middleware/adminAuth.ts` + `src/routes/admin.routes.ts` gate everything mounted under `/api/admin` behind an `X-Admin-Key` header check — see Admin routes below. Cloudflare R2 image uploads are in place (Issue #26 / M2.2): `src/externalService/r2.ts` is the first external-service client, `src/modules/uploads/` presigns direct-to-R2 uploads and tracks issued-but-unconsumed object keys in MongoDB with a TTL index, and `errorHandler.ts` now also translates a thrown `ZodError` into the standard error contract. A second, backend-proxied upload path (`POST /api/admin/uploads/direct`, `multer`-backed, SRS amendment `FR-CAT-097`–`100`) was added alongside the presigned path, and `errorHandler.ts` also translates a thrown `MulterError` — see R2 uploads below. Brand management is in place (Issue #27 / M2.3): `src/modules/brands/` is the first real catalog-entity module (model/repository/service/controller/routes/module, DB-backed) — see Brands below for the module itself and for the reusable conventions it introduces (`src/utils/slug.ts`, `:id` route validation, and a narrow cross-module repository exception) that categories (#28) and products (#31) are expected to copy.

## How to add a new module

1. Create `src/modules/<feature>/` with:
   - `<feature>.routes.ts` — pure route definitions (method + path → controller)
   - `<feature>.controller.ts` — request/response shaping, calls the service
   - `<feature>.service.ts` — business logic, orchestrates the repository
   - `<feature>.repository.ts` — Mongoose queries only (skip if the module needs no DB access)
   - `<feature>.model.ts` — Mongoose schema (skip if the module owns no collection)
   - `<feature>.module.ts` — imports `<feature>.routes.ts`'s router, exports `{ path, router }`
   - `tests/` — colocated unit tests for this module
2. Wire it into `src/routes/index.ts`: import the module and add `router.use(<feature>Module.path, <feature>Module.router)`.
3. If the module needs end-to-end coverage, add a Supertest file under the workspace-root `__tests__/<feature>/` (see `__tests__/health/health.api.test.ts` for the pattern).

`src/modules/health/` is the current worked reference — copy its shape.

## Path aliases

`@/*` maps to `src/*` (`backend/tsconfig.json`'s `paths`). Use it for any import that would otherwise need `../` parent traversal (e.g. reaching `config/`, `middleware/`, `utils/`, `externalService/` from inside a module); same-directory or one-level-down-from-`src` imports stay relative. Works everywhere: `tsc` build (rewritten to relative paths by `tsc-alias`, run right after `tsc` in the `build` script), `tsx watch` dev server (native tsconfig-paths support), and Vitest via the `vite-tsconfig-paths` plugin in `vitest.config.ts` (there is no native `resolve.tsconfigPaths` option — an earlier version of this doc claimed there was, which was wrong and left `__tests__/health/health.api.test.ts` failing until Issue #8 fixed it) — one alias defined once in `tsconfig.json`.

## Error contract

- `src/utils/AppError.ts` — `class AppError extends Error { constructor(statusCode, code, message) }`
- `src/middleware/errorHandler.ts` — 4-arg Express error middleware. `AppError` instances → `{ success:false, code, message }` at `err.statusCode`; a `ZodError` (thrown directly from a controller, e.g. `schema.parse(req.body)`) → 400 `{ success:false, code:"VALIDATION_ERROR", errors }`, where `errors` is an object keyed by field path (`issue.path.join(".")`) with that field's own Zod message as the value — no `message` key on this response; a `MulterError` (thrown by the `multer` middleware itself, before a controller runs — e.g. an oversized file) → 400 `{ success:false, code, message }`, where `code` is `"FILE_TOO_LARGE"` for `LIMIT_FILE_SIZE` and `"UPLOAD_ERROR"` for every other Multer error code; anything else → 500 `{ success:false, code:"INTERNAL_ERROR", message:"Internal server error" }`. Never leaks `err.stack`.
- `src/middleware/notFound.ts` — catch-all for unmatched routes → 404 `{ success:false, code:"NOT_FOUND", message:"Route not found" }`.

Both are mounted in `src/app.ts`, after all routes. Because Express 5 (already a dependency) auto-forwards a thrown or rejected error from an async route handler to this middleware, a controller can call `schema.parse(req.body)` directly with no manual `try`/`catch` — see `src/modules/uploads/uploads.controller.ts` for the pattern every later M2 admin endpoint should copy.

## Success envelope

`src/utils/apiResponse.ts`'s `successResponse(data)` / `successResponse(data, pagination)` is the one place every controller builds its success response from — mirrors the error contract's single-source-of-truth shape:

- Detail: `successResponse(data)` → `{ success: true, data }`, no `pagination` key at all.
- List: `successResponse(items, { page, limit, total, totalPages, hasNextPage })` → `{ success: true, data: items, pagination }`.

Built as two overloads returning a conditionally-constructed object literal (never `pagination: undefined`) specifically because `tsconfig.base.json` sets `exactOptionalPropertyTypes: true` — assigning `undefined` to an optional field is a type error there, and would violate the "omit entirely, never `null`/`{}`" rule anyway.

`health` predates this helper and still returns its own `{ success, code, message }` shape — left as-is; it isn't a catalog resource.

## Admin routes and auth

- `src/middleware/adminAuth.ts` — checks the `X-Admin-Key` request header against `env.ADMIN_API_KEY`; mismatch → `next(new AppError(401, "UNAUTHORIZED", ...))`, so it produces the exact same error-contract shape as everything else, not a one-off `res.json`.
- `src/routes/admin.routes.ts` — a dedicated router with `adminRouter.use(adminAuth)` applied once, mounted at `/api/admin` in `src/routes/index.ts`. Every M2 admin feature module (brands, categories, products, ...) mounts under this router as it lands (`adminRouter.use(<feature>Module.path, <feature>Module.router)`) — the guard never needs touching per-route, and the whole thing is swapped out in one place when v0.3 replaces it with real session/RBAC auth.
- Buyer-facing (non-admin) routes mount directly on the root aggregator router in `src/routes/index.ts`, same as `health` does today.

## R2 uploads

- `src/externalService/r2.ts` — the first client under `externalService/`. Wraps `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`: constructs an `S3Client` pointed at `https://{env.R2.ACCOUNT_ID}.r2.cloudflarestorage.com`, exports `createPresignedPutUrl(key, contentType)` returning a 5-minute presigned PUT URL, and `uploadObject(key, body, contentType)` — a plain `PutObjectCommand` sent via `client.send()`, used by the direct-upload path below. Presigning is a local signature computation — no network call — so it's fully unit-testable with dummy credentials; only actually uploading (through the presigned URL, or via `uploadObject`) touches the network.
- `src/modules/uploads/` — `POST /presign` (mounted as `/api/admin/uploads/presign`) and `POST /direct` (mounted as `/api/admin/uploads/direct`), the module's own model/repository/service pattern, plus reusable entity-agnostic exports from `uploads.service.ts` that later modules import directly rather than duplicating:
  - `POST /direct` (SRS amendment `FR-CAT-097`–`100`, the one deliberate exception to `FR-CAT-077`'s "backend never receives raw image bytes") accepts the image itself as `multipart/form-data` (a `file` field plus a `purpose` field), parsed in-memory by `multer` (`uploads.routes.ts`, `multer.memoryStorage()`, `limits.fileSize` capped at `MAX_DIRECT_UPLOAD_BYTES` — 5 MB), then uploads the buffer to R2 itself via `issueDirectUpload()` in `uploads.service.ts`. Same content-type allow-list as presign, same `{purpose}/{uuid}.{ext}` object key format, same `presignedUploads` tracking record — a product/brand/category registration consumes a direct-upload key identically to a presigned one, since `consumeImageKeys` doesn't distinguish which path produced the key.
  - Exists specifically for clients that can't perform a direct browser-to-R2 PUT (server-side tooling, scripts, classic form submission); the presigned path (`FR-CAT-077`–`081`) remains the default/preferred path for browser clients.
  - `consumeImageKeys(keys)` — validates each object key was issued by a prior presign call and not already consumed (`FR-CAT-082`); called by product/brand/category create-and-update paths once they exist.
  - `validateImageCount(images, { min, max })` — bounds check (`FR-CAT-083`); callers pass `{min:1,max:8}` for products, `{min:0,max:2}` for variants.
  - `normalizeImages(images)` — ensures exactly one `isPrimary: true`, auto-promoting the first image if none is marked (`FR-CAT-084`). Pure function, no I/O.
  - This module intentionally doesn't expose a `/products/:id/images`-style registration endpoint — brands/categories/products don't exist as collections yet. It builds the shared pieces; #27 (brands), #28 (categories), and #31 (products/variants) wire them into their own create/update controllers.
- Issued-but-unconsumed object keys are tracked in a `presignedUploads` MongoDB collection (`uploads.model.ts`), not in memory — a TTL index on `expiresAt` auto-deletes stale entries, and the choice avoids the correctness gaps an in-memory store would have (lost on restart, not shared across instances). `uploads.repository.ts`'s `consumeByKey` is an atomic `findOneAndDelete`; not-found collapses "never issued" and "already consumed" into one rejection, matching `FR-CAT-082`'s wording without needing to distinguish the two.
- New env vars are namespaced under `env.R2` in code even though the underlying `.env` entries are flat (env files can't nest keys) — see `src/config/env.ts`: `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`R2_PUBLIC_URL_BASE` parse as flat fields, then get reshaped into `env.R2.ACCOUNT_ID` etc. before export. `R2_PUBLIC_URL_BASE` is the browser-accessible bucket URL (custom domain or `r2.dev`) used to build a registered image's stored `url`; it's distinct from the R2 API endpoint used to sign uploads, which is derived from `R2_ACCOUNT_ID`.

## Brands

`src/modules/brands/` (Issue #27 / M2.3, `FR-CAT-023`–`029`) is the first module with a real Mongoose collection beyond `uploads`' tracking one. Scope is deliberately just issue #27's own checklist — create/update/list-with-count/get/guarded-delete plus a public active-only list — not the status-toggle endpoint (`FR-CAT-047`, owned by #33) or admin search (`FR-CAT-052`, owned by #34); the SRS's endpoint table lists those near brands, but the project's issue breakdown defers them until brands+categories+products all exist, matching how categories (#28) is split too.

- **Two mount points, one module**: `brands.module.ts` exports `brandsAdminModule` (`path: "/brands"`, mounted under `adminRouter` → `/api/admin/brands`, guarded) and `brandsPublicModule` (`path: "/api/brands"`, mounted directly on the root router in `routes/index.ts`, unguarded) — the first module needing both an admin and a buyer-facing surface.
- **`src/utils/slug.ts`** (new, shared): `slugify(name)` + `generateUniqueSlug(name, slugExists)`, taking an injected `slugExists` checker rather than querying Mongoose directly, so it's DB-agnostic and reusable by categories/products. Suffixes collisions `-2`, `-3`, ... A brand's slug is generated once at create time and never touched on update (`FR-CAT-025` only lists name/logo/description as updatable).
- **`src/modules/products/` stub**: issue #31 (the real product module) doesn't exist yet, but `FR-CAT-026` (admin list's product count) and `FR-CAT-028` (delete guard) both need to query products. `products.model.ts` is a deliberately partial schema (`brand`, `status`, timestamps only — extend, don't replace, when #31 lands), and `products.repository.ts` exposes only `countByBrand(id)` / `countByBrandIds(ids)`, no service/controller/routes.
- **Cross-module repository import — the one layering exception**: `brands.service.ts` imports `countByBrand`/`countByBrandIds` directly from `@/modules/products/products.repository` rather than `brands.repository.ts` reaching into the `Product` model itself, or `brands.service.ts` skipping the repository layer entirely. Every module's repository still stays scoped to its own model; this is a peer service-to-repository import, narrow and commented where it happens.
- **`:id` route validation — new pattern, copy it going forward**: neither `health` nor `uploads` has an `:id` route, and `errorHandler.ts` has no `CastError` handling, so an invalid ObjectId string would otherwise fall through to a generic 500. `brands.controller.ts`'s `parseObjectId()` checks `mongoose.isValidObjectId()` first and throws `AppError(400, "INVALID_ID", ...)` — note it also has to account for `req.params.id`'s real type, `string | string[] | undefined` (`ParamsDictionary`'s index signature under `noUncheckedIndexedAccess: true`), not just `string`.
- **`buildPublicUrl(objectKey)`**: extracted from `uploads.service.ts` (previously inlined twice) so brands' logo-URL construction, and later categories'/products' image-URL construction, doesn't duplicate the `${env.R2.PUBLIC_URL_BASE}/${objectKey}` interpolation a third and fourth time.
- **Known, accepted races (documented, not fixed)**: delete-guard TOCTOU (a product could be created between the count-check and the delete) and slug-uniqueness TOCTOU (two concurrent creates with the same name could both pass `slugExists` before either inserts, surfacing as a Mongo `E11000` → generic 500). No transactions or test-DB exist anywhere in this codebase yet; categories' `FR-CAT-019` guard will have the identical gap.
- Test layout follows the established split: `src/modules/brands/tests/brands.service.test.ts` (unit, repository/uploads-service mocked) and `__tests__/brands/brands.api.test.ts` (Supertest, same mocking, exercises the real Express app end-to-end).

## Startup

`src/index.ts` exports an async `startServer()`: it awaits `connectDB()` first — on rejection it logs the error and calls `process.exit(1)` **without** calling `app.listen()`, so the process never silently serves traffic against a dead DB connection; only on success does it call `app.listen(env.PORT, ...)`. The unconditional call at the bottom of the file is guarded with `if (require.main === module) startServer();`, so requiring/importing `index.ts` (e.g. from a test) doesn't trigger a real startup as a side effect — only running it directly (`node`/`tsx src/index.ts`, which is what `npm run dev`/the compiled `dist/index.js` do) does. This is what makes the failure path unit-testable — see `src/tests/index.test.ts`, which imports `{ startServer }` and mocks `connectDB`.

## Dev workflow

- `npm run dev --workspace backend` — `tsx watch src/index.ts`
- `npm run build --workspace backend` — `tsc && tsc-alias`, must produce zero errors
- `npm run test --workspace backend` — `vitest run`
- `npm run test:coverage --workspace backend` — `vitest run --coverage` (v8 provider, text + HTML reporters; no enforced threshold yet)
- Copy `.env.example` to `.env` before running locally (`PORT`, `NODE_ENV`, `MONGODB_URI`, `ADMIN_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE`) — `src/config/env.ts` validates all of these with `zod` at import time and throws immediately if any required value is missing, so a misconfigured `.env` fails on startup rather than partway through a request. The five `R2_*` vars are read in code via `env.R2.ACCOUNT_ID` etc., not the flat names.
- `env.ts` loads env files by mode: `.env.${NODE_ENV}` first, then `.env` fills in anything not already set (dotenv never overwrites an existing `process.env` key). So `.env.development`/`.env.test`/`.env.production` are optional per-mode overrides layered on top of the shared `.env` — a missing mode-specific file is a silent no-op, not an error. All of them are gitignored; only `.env.example` is committed.
- Tests don't need a real `.env`: `vitest.config.ts`'s `test.env` injects dummy values for all required vars (`MONGODB_URI`, `ADMIN_API_KEY`, the five `R2_*` vars) directly into `process.env` for the whole run (Vitest also sets `NODE_ENV=test` itself, so `env.ts` would look for `.env.test` too — it doesn't need to exist, since the injected values already satisfy the `zod` schema before `dotenv.config()` would matter). Nothing in the test suite opens a real MongoDB connection or a real R2 bucket; `connectDB` and `r2.ts`'s `createPresignedPutUrl` are mocked wherever they're exercised.

Test files: colocated `src/modules/<feature>/tests/*.test.ts` (or `src/<area>/tests/*.test.ts` for cross-cutting utilities, e.g. `src/utils/tests/apiResponse.test.ts`, `src/tests/index.test.ts`) for unit tests, workspace-root `__tests__/<feature>/*.test.ts` for Supertest integration tests. Both globs are wired in `vitest.config.ts`.

## Current module inventory

- `health` — `GET /health`, no DB access, reference implementation for the module pattern above.
- `uploads` — `POST /api/admin/uploads/presign` (Issue #26 / M2.2). Owns the `presignedUploads` tracking collection but no product-like resource of its own; exports `consumeImageKeys`/`validateImageCount`/`normalizeImages`/`buildPublicUrl` for reuse by later modules — see R2 uploads above.
- `brands` — `POST|GET|PATCH|DELETE /api/admin/brands[/:id]` + public `GET /api/brands` (Issue #27 / M2.3). First DB-backed catalog-entity module — see Brands above.
- `products` — stub only (`products.model.ts` + a two-function `products.repository.ts`), not a real module yet; brands' delete guard and product-count aggregation are its only consumers until #31 lands.
- No category modules exist yet. Issues #28–#36 mount their modules under `adminRouter` (admin-side) or the root router (buyer-facing) as they land.
