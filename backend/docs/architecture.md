# backend — architecture

Implementation-level detail for `backend/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.3 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Request flow

```
Client
  → src/app.ts            express() instance, express.json() body parser
    → src/routes/index.ts   aggregator: mounts each module's router
      → <feature>.module.ts   wiring point, exports { path, router }
        → <feature>.routes.ts  method + path → controller
          → <feature>.controller.ts  shapes the HTTP response, calls service
            → <feature>.service.ts    business logic, orchestrates repository
              → <feature>.repository.ts  Mongoose queries only (DB-backed modules)
                → <feature>.model.ts      Mongoose schema

  (thrown error at any layer, including a ZodError from schema.parse(req.body))
  → src/middleware/errorHandler.ts   → { success:false, code, message } JSON, never leaks err.stack

  (no route matched)
  → src/middleware/notFound.ts       → 404 { success:false, code:"NOT_FOUND", message:"Route not found" }
```

`src/app.ts` exports the configured Express app without calling `.listen()` — `src/index.ts`'s exported `startServer()` is the only place that binds a port, and only after `connectDB()` resolves, so Supertest can still import `app` directly for integration tests without a live server or a real DB connection.

Admin-only routes take one extra hop: `src/routes/admin.routes.ts` applies `adminAuth` (`src/middleware/adminAuth.ts`) via `router.use()` before any admin feature module's router, mounted at `/api/admin` in `src/routes/index.ts`. A missing/wrong `X-Admin-Key` header short-circuits straight to `errorHandler.ts` via `next(new AppError(401, ...))`, never reaching a feature module's controller.

The `uploads` module (Issue #26 / M2.2) additionally calls out to `src/externalService/r2.ts` from its service layer — the first external-service client in the request flow, sitting between `uploads.service.ts` and the actual Cloudflare R2 API.

## Current file tree

```
backend/
├── package.json           # name "backend", type "commonjs"; scripts: build (tsc), dev (tsx watch), test (vitest run)
├── tsconfig.json            # extends ../tsconfig.base.json
├── vitest.config.ts           # node environment; test.env injects dummy MONGODB_URI/ADMIN_API_KEY/R2_*; include src/**/tests/**/*.test.ts and __tests__/**/*.test.ts
├── .env.example                 # PORT, NODE_ENV, MONGODB_URI, ADMIN_API_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL_BASE
├── .env / .env.development / .env.test / .env.production   # all gitignored; mode-specific overrides layered on top of .env
│
├── __tests__/
│   ├── health/
│   │   └── health.api.test.ts    # Supertest, full app, GET /health + 404 path
│   ├── admin-auth/
│   │   └── admin-auth.api.test.ts  # Supertest, missing/wrong/correct X-Admin-Key against /api/admin
│   ├── uploads/
│   │   └── uploads.api.test.ts     # Supertest, POST /api/admin/uploads/{presign,direct}, r2.ts mocked
│   └── product-catalog/            # mirrors src/modules/product-catalog/features/ — one Supertest file per catalog entity module
│       ├── brands/
│       │   └── brands.api.test.ts
│       ├── categories/
│       │   └── categories.api.test.ts
│       ├── categorySpecifications/
│       │   └── categorySpecifications.api.test.ts
│       ├── categoryVariants/
│       │   └── categoryVariants.api.test.ts
│       └── products/
│           └── products.api.test.ts
│
└── src/
    ├── index.ts                    # exports startServer(); require.main-guarded self-invocation
    ├── app.ts                       # express instance, mounts routes/index.ts + error middleware
    │
    ├── config/
    │   ├── env.ts                    # zod-validated: PORT, NODE_ENV, MONGODB_URI, ADMIN_API_KEY, R2_*; loads .env.<NODE_ENV> then .env; R2_* reshaped into env.R2.*
    │   └── db.ts                      # connectDB() / disconnectDB() — live mongoose.connect(env.MONGODB_URI)
    │
    ├── routes/
    │   ├── index.ts                    # imports each module's .module.ts, mounts it; mounts admin.routes.ts at /api/admin
    │   └── admin.routes.ts               # adminRouter.use(adminAuth); mounts uploadsModule and later admin feature modules
    │
    ├── middleware/
    │   ├── notFound.ts
    │   ├── errorHandler.ts             # also translates a thrown ZodError into { success:false, code:"VALIDATION_ERROR", errors: { field: reason } }, and a thrown MulterError into { success:false, code:"FILE_TOO_LARGE"|"UPLOAD_ERROR", message }
    │   └── adminAuth.ts                # X-Admin-Key check → next(new AppError(401, ...)) on mismatch
    │
    ├── utils/
    │   ├── AppError.ts
    │   ├── apiResponse.ts              # successResponse(data) / successResponse(data, pagination)
    │   └── tests/
    │       └── apiResponse.test.ts
    │
    ├── tests/
    │   └── index.test.ts               # mocks connectDB; asserts startServer()'s listen-vs-exit(1) branches
    │
    ├── externalService/
    │   └── r2.ts                        # first external client — S3-compatible presigned PUT URLs + a plain uploadObject() PUT, via @aws-sdk
    │
    └── modules/
        ├── health/
        │   ├── health.module.ts
        │   ├── health.routes.ts
        │   ├── health.controller.ts
        │   ├── health.service.ts
        │   ├── health.repo.ts            # stub — health needs no DB access; keeps the template shape consistent
        │   └── tests/
        │       └── health.service.test.ts
        │
        ├── uploads/
        │   ├── uploads.module.ts          # { path: "/uploads", router }
        │   ├── uploads.routes.ts          # POST /presign; POST /direct (multer memoryStorage, limits.fileSize = MAX_DIRECT_UPLOAD_BYTES)
        │   ├── uploads.controller.ts      # zod-validates { purpose, contentType } or { purpose } + req.file, calls the service
        │   ├── uploads.service.ts         # issuePresignedUpload + issueDirectUpload + consumeImageKeys/validateImageCount/normalizeImages
        │   ├── uploads.repository.ts       # createPendingUpload / consumeByKey (findOneAndDelete)
        │   ├── uploads.model.ts            # presignedUploads collection, TTL index on expiresAt
        │   └── tests/
        │       └── uploads.service.test.ts
        │
        └── product-catalog/               # groups every catalog-domain entity module; uploads/health stay flat above since they're cross-cutting infra, not catalog entities
            └── features/
                ├── brands/                     # Issue #27/M2.3 — see Brands in CLAUDE.md
                │   ├── brands.module.ts             # { brandsAdminModule, brandsPublicModule }
                │   ├── brands.admin.routes.ts
                │   ├── brands.public.routes.ts
                │   ├── brands.controller.ts
                │   ├── brands.service.ts
                │   ├── brands.repository.ts
                │   ├── brands.model.ts
                │   └── tests/
                │       └── brands.service.test.ts
                │
                ├── categories/                  # Issue #28/M2.4 — see Categories in CLAUDE.md
                │   ├── categories.module.ts         # { categoriesAdminModule, categoriesPublicModule }
                │   ├── categories.admin.routes.ts
                │   ├── categories.public.routes.ts
                │   ├── categories.controller.ts
                │   ├── categories.service.ts
                │   ├── categories.repository.ts
                │   ├── categories.model.ts
                │   └── tests/
                │       └── categories.service.test.ts
                │
                ├── categorySpecifications/      # Issue #29/M2.5 — admin-only (GET/PUT/PATCH), mounted mergeParams:true under /categories/:id/specifications
                │   ├── categorySpecifications.module.ts
                │   ├── categorySpecifications.routes.ts
                │   ├── categorySpecifications.controller.ts
                │   ├── categorySpecifications.service.ts
                │   ├── categorySpecifications.repository.ts
                │   ├── categorySpecifications.model.ts
                │   └── tests/
                │       └── categorySpecifications.service.test.ts
                │
                ├── categoryVariants/            # Issue #30/M2.6 — admin-only (GET/PUT/PATCH), same mergeParams:true shape as categorySpecifications
                │   ├── categoryVariants.module.ts
                │   ├── categoryVariants.routes.ts
                │   ├── categoryVariants.controller.ts
                │   ├── categoryVariants.service.ts
                │   ├── categoryVariants.repository.ts
                │   ├── categoryVariants.model.ts
                │   └── tests/
                │       └── categoryVariants.service.test.ts
                │
                └── products/                    # Issues #31–#36/M2.7-M2.12 — see Products/Product Variants/Status Updates/Admin Search/Buyer Browsing/Buyer Filtering in CLAUDE.md
                    ├── products.module.ts           # { productsAdminModule, productsPublicModule }
                    ├── products.admin.routes.ts
                    ├── products.public.routes.ts
                    ├── products.controller.ts
                    ├── products.service.ts
                    ├── products.repository.ts
                    ├── products.model.ts
                    └── tests/
                        └── products.service.test.ts
```

## Config

- `src/config/env.ts` validates `process.env` with a `zod` schema (`PORT` coerced to number default `4000`, `NODE_ENV` default `"development"`, `MONGODB_URI`/`ADMIN_API_KEY`/the five `R2_*` vars all required strings). `envSchema.parse(process.env)` throws synchronously on import if a required var is missing or invalid — the process never starts against bad config. This is the first `zod` usage in the workspace (Issue #25 / M2.1).
- Env file loading is mode-based: `dotenv.config()` first loads a mode-specific file (`.env.development`, `.env.test`, or `.env.production`, chosen by `NODE_ENV`), then a second `dotenv.config()` call loads the shared `.env` to fill in anything the mode file didn't set. `dotenv` never overwrites a key already present in `process.env`, so this is a layering, not an override chain — a real environment variable (CI, a hosting platform) always wins over either file, the mode-specific file wins over the shared `.env`, and a missing mode-specific file is a silent no-op (not an error). All of `.env`, `.env.development`, `.env.test`, and `.env.production` are gitignored; only `.env.example` is committed as the documented template.
- The five `R2_*` vars are parsed flat (env files can't nest keys) but reshaped before export so calling code reads `env.R2.ACCOUNT_ID`, `env.R2.ACCESS_KEY_ID`, `env.R2.SECRET_ACCESS_KEY`, `env.R2.BUCKET_NAME`, `env.R2.PUBLIC_URL_BASE` — a namespaced sub-object, not five flat top-level keys. `R2_PUBLIC_URL_BASE` (the browser-accessible bucket URL — custom domain or `r2.dev`) is distinct from the R2 API endpoint used to sign uploads, which `r2.ts` derives from `R2_ACCOUNT_ID` as `https://{accountId}.r2.cloudflarestorage.com`.
- `src/config/db.ts` exports `connectDB()` (a thin `mongoose.connect(env.MONGODB_URI)` wrapper) and `disconnectDB()` (`mongoose.disconnect()`, for graceful shutdown — not yet wired into a signal handler, available for when that's needed). `connectDB()` is called from `src/index.ts`'s `startServer()`, not from `db.ts` itself.

## Startup

`src/index.ts` exports an async `startServer()`:

1. `await connectDB()` — on rejection, logs the error and calls `process.exit(1)`, **without** calling `app.listen()`.
2. On success, calls `app.listen(env.PORT, ...)`.

The file's only top-level side effect is `if (require.main === module) startServer();` — so requiring/importing `index.ts` (as a test does) never triggers a real startup, only running it directly does (`tsx src/index.ts` in dev, `node dist/index.js` once built). That guard is what makes the failure branch unit-testable without inventing a separate bootstrap module: `src/tests/index.test.ts` imports `{ startServer }`, mocks `connectDB` to resolve/reject, and asserts `app.listen`/`process.exit` are called correctly in each case — no real MongoDB instance needed in the test run. Actually connecting to a live database and confirming the process exits when it's unreachable is verified manually/locally, not in the automated suite (no `mongodb-memory-server` or CI service container — a deliberate scope decision for Issue #25).

## Success envelope

`src/utils/apiResponse.ts`'s `successResponse()` produces the `{ success: true, data }` / `{ success: true, data, pagination }` shapes from `docs/srs/features/0.2-product-catalog.md` `FR-CAT-093`/`094`. Two overloads (detail vs. list) build the return object conditionally — `pagination` is either fully present or entirely absent from the object, never assigned `undefined` — because root `tsconfig.base.json` sets `exactOptionalPropertyTypes: true`. `health`'s response shape predates this helper and is intentionally left unchanged.

## Admin auth

`src/middleware/adminAuth.ts` compares the `X-Admin-Key` request header against `env.ADMIN_API_KEY`; a mismatch calls `next(new AppError(401, "UNAUTHORIZED", ...))` rather than writing `res.json` directly, so it flows through the same `errorHandler.ts` path as every other error. `src/routes/admin.routes.ts` applies it once via `router.use(adminAuth)` and is mounted at `/api/admin` — every later M2 admin feature module mounts under this router, so the guard is never duplicated per-route and the whole thing is a one-place swap when v0.3 lands real session/RBAC auth (`FR-CAT-088`–`090`).

## R2 uploads (Issue #26 / M2.2)

`src/externalService/r2.ts` wraps `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — an `S3Client` pointed at R2's S3-compatible endpoint, exporting `createPresignedPutUrl(key, contentType)` for a 5-minute presigned PUT URL, and `uploadObject(key, body, contentType)`, a plain `PutObjectCommand` sent via `client.send()` for the direct-upload path below. Presigning is a local signature computation, not a network call, so it's fully unit-testable with dummy credentials; only the client's actual `PUT` upload (via the presigned URL, or via `uploadObject`) touches the network.

`src/modules/uploads/` is entity-agnostic by design (`FR-CAT-077`–`084`, `097`–`100`) and exposes two upload paths:

- `POST /presign` (mounted as `/api/admin/uploads/presign`) generates a server-side `{purpose}/{uuid}.{ext}` object key (never client-influenced, per `FR-CAT-079`), calls `r2.ts`'s `createPresignedPutUrl`, and persists a tracking record. This remains the default/preferred path — the backend never sees the raw file.
- `POST /direct` (mounted as `/api/admin/uploads/direct`, SRS amendment `FR-CAT-097`–`100`) is the one deliberate exception to that rule: a `multer`-parsed (`memoryStorage`, `limits.fileSize` capped at `MAX_DIRECT_UPLOAD_BYTES` — 5 MB) `multipart/form-data` upload, for clients that can't perform a direct browser-to-R2 PUT. The controller validates `req.file.mimetype` against the same allow-list as presign, then `issueDirectUpload()` generates the same object-key format, calls `r2.ts`'s `uploadObject`, and persists the same kind of tracking record — so downstream registration can't tell which path produced a given key.

Its service layer also exports three functions meant for reuse by later modules rather than being called only from this one's own controller:

- `consumeImageKeys(keys)` — validates each key was actually issued and not already consumed (`FR-CAT-082`), via `uploads.repository.ts`'s atomic `findOneAndDelete`. Not-found collapses "never issued" and "already consumed" into a single rejection.
- `validateImageCount(images, { min, max })` — bounds check (`FR-CAT-083`): `{min:1,max:8}` for products, `{min:0,max:2}` for variants.
- `normalizeImages(images)` — ensures exactly one `isPrimary: true`, auto-promoting the first image if none is marked (`FR-CAT-084`); a pure function, no I/O.

This module doesn't expose a `/products/:id/images`-style registration endpoint of its own — brands/categories/products don't exist as collections at this point in the build order. Issues #27 (brands), #28 (categories), and #31 (products/variants) import these three functions into their own create/update controllers rather than reimplementing key-consumption/bounds/primary-image logic.

Issued-but-unconsumed keys live in a `presignedUploads` MongoDB collection, not in memory — a TTL index on `expiresAt` auto-deletes stale entries. In-memory tracking was considered and rejected: it wouldn't survive a process restart or work across multiple backend instances, both real correctness gaps given Mongo is already a required, live dependency (Issue #25 / M2.1).

## Path aliases

`tsconfig.json`'s `paths` maps `@/*` → `src/*`. Use it for imports that would otherwise need `../` parent traversal; same-directory or one-level-down imports stay relative. This is a single source of truth resolved three different ways at runtime/build time:

- `tsc` (build) doesn't rewrite aliases when emitting JS, so `tsc-alias` runs immediately after it in the `build` script, rewriting `@/...` in `dist/` back to relative paths.
- `tsx` (dev) resolves `tsconfig.json`'s `paths` natively — no extra tooling.
- Vitest resolves them via the `vite-tsconfig-paths` plugin in `vitest.config.ts`, reading the same `tsconfig.json` rather than a hand-duplicated alias map. (There is no native `resolve.tsconfigPaths` option in Vite/Vitest — this doc previously claimed otherwise, which left `__tests__/health/health.api.test.ts` failing to resolve `@/app` until Issue #8 fixed it. `buyer-app`/`admin-app` use the same plugin, for the same reason.)

## Testing

- **Unit tests** colocate near what they test: `src/modules/<feature>/tests/*.test.ts` for a module's own logic, or `src/<area>/tests/*.test.ts` for a cross-cutting utility that isn't a module (e.g. `src/utils/tests/apiResponse.test.ts`, `src/tests/index.test.ts`).
- **Integration tests** live at the workspace root: `__tests__/<feature>/*.test.ts`, using Supertest against the exported `app` from `src/app.ts` — exercise the full request/response cycle including middleware.
- Both globs (`src/**/tests/**/*.test.ts`, `__tests__/**/*.test.ts`) are registered in `vitest.config.ts`'s `test.include`. `test.env` there also injects placeholder `MONGODB_URI`/`ADMIN_API_KEY`/`R2_*` values for the whole run, since `src/config/env.ts`'s `zod` schema would otherwise throw before any test file even loads — no test opens a real MongoDB connection or a real R2 bucket; `connectDB` is mocked wherever `startServer()` is exercised, and `r2.ts`'s `createPresignedPutUrl`/`uploadObject` are mocked wherever the `uploads` module is exercised.
- **Coverage**: `npm run test:coverage --workspace backend` (v8 provider, text + HTML reporters, configured in `vitest.config.ts`'s `test.coverage`). No enforced threshold yet — reporting only, per Issue #3's scope; a coverage gate lands once real features (not just the skeleton) exist to measure.
