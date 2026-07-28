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

  (thrown error at any layer)
  → src/middleware/errorHandler.ts   → { success:false, code, message } JSON, never leaks err.stack

  (no route matched)
  → src/middleware/notFound.ts       → 404 { success:false, code:"NOT_FOUND", message:"Route not found" }
```

`src/app.ts` exports the configured Express app without calling `.listen()` — `src/index.ts`'s exported `startServer()` is the only place that binds a port, and only after `connectDB()` resolves, so Supertest can still import `app` directly for integration tests without a live server or a real DB connection.

Admin-only routes take one extra hop: `src/routes/admin.routes.ts` applies `adminAuth` (`src/middleware/adminAuth.ts`) via `router.use()` before any admin feature module's router, mounted at `/api/admin` in `src/routes/index.ts`. A missing/wrong `X-Admin-Key` header short-circuits straight to `errorHandler.ts` via `next(new AppError(401, ...))`, never reaching a feature module's controller.

## Current file tree

```
backend/
├── package.json           # name "backend", type "commonjs"; scripts: build (tsc), dev (tsx watch), test (vitest run)
├── tsconfig.json            # extends ../tsconfig.base.json
├── vitest.config.ts           # node environment; test.env injects dummy MONGODB_URI/ADMIN_API_KEY; include src/**/tests/**/*.test.ts and __tests__/**/*.test.ts
├── .env.example                 # PORT, NODE_ENV, MONGODB_URI, ADMIN_API_KEY
├── .env / .env.development / .env.test / .env.production   # all gitignored; mode-specific overrides layered on top of .env
│
├── __tests__/
│   ├── health/
│   │   └── health.api.test.ts    # Supertest, full app, GET /health + 404 path
│   └── admin-auth/
│       └── admin-auth.api.test.ts  # Supertest, missing/wrong/correct X-Admin-Key against /api/admin
│
└── src/
    ├── index.ts                    # exports startServer(); require.main-guarded self-invocation
    ├── app.ts                       # express instance, mounts routes/index.ts + error middleware
    │
    ├── config/
    │   ├── env.ts                    # zod-validated: PORT, NODE_ENV, MONGODB_URI, ADMIN_API_KEY; loads .env.<NODE_ENV> then .env
    │   └── db.ts                      # connectDB() / disconnectDB() — live mongoose.connect(env.MONGODB_URI)
    │
    ├── routes/
    │   ├── index.ts                    # imports each module's .module.ts, mounts it; mounts admin.routes.ts at /api/admin
    │   └── admin.routes.ts               # adminRouter.use(adminAuth) — admin feature modules mount here
    │
    ├── middleware/
    │   ├── notFound.ts
    │   ├── errorHandler.ts
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
    ├── externalService/                # empty — third-party API clients; first is Cloudflare R2 (M2), then Razorpay (M6+)
    │
    └── modules/
        └── health/
            ├── health.module.ts
            ├── health.routes.ts
            ├── health.controller.ts
            ├── health.service.ts
            ├── health.repo.ts            # stub — health needs no DB access; keeps the template shape consistent
            └── tests/
                └── health.service.test.ts
```

## Config

- `src/config/env.ts` validates `process.env` with a `zod` schema (`PORT` coerced to number default `4000`, `NODE_ENV` default `"development"`, `MONGODB_URI` and `ADMIN_API_KEY` both required strings). `envSchema.parse(process.env)` throws synchronously on import if a required var is missing or invalid — the process never starts against bad config. This is the first `zod` usage in the workspace (Issue #25 / M2.1).
- Env file loading is mode-based: `dotenv.config()` first loads a mode-specific file (`.env.development`, `.env.test`, or `.env.production`, chosen by `NODE_ENV`), then a second `dotenv.config()` call loads the shared `.env` to fill in anything the mode file didn't set. `dotenv` never overwrites a key already present in `process.env`, so this is a layering, not an override chain — a real environment variable (CI, a hosting platform) always wins over either file, the mode-specific file wins over the shared `.env`, and a missing mode-specific file is a silent no-op (not an error). All of `.env`, `.env.development`, `.env.test`, and `.env.production` are gitignored; only `.env.example` is committed as the documented template.
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

## Path aliases

`tsconfig.json`'s `paths` maps `@/*` → `src/*`. Use it for imports that would otherwise need `../` parent traversal; same-directory or one-level-down imports stay relative. This is a single source of truth resolved three different ways at runtime/build time:

- `tsc` (build) doesn't rewrite aliases when emitting JS, so `tsc-alias` runs immediately after it in the `build` script, rewriting `@/...` in `dist/` back to relative paths.
- `tsx` (dev) resolves `tsconfig.json`'s `paths` natively — no extra tooling.
- Vitest resolves them via the `vite-tsconfig-paths` plugin in `vitest.config.ts`, reading the same `tsconfig.json` rather than a hand-duplicated alias map. (There is no native `resolve.tsconfigPaths` option in Vite/Vitest — this doc previously claimed otherwise, which left `__tests__/health/health.api.test.ts` failing to resolve `@/app` until Issue #8 fixed it. `buyer-app`/`admin-app` use the same plugin, for the same reason.)

## Testing

- **Unit tests** colocate near what they test: `src/modules/<feature>/tests/*.test.ts` for a module's own logic, or `src/<area>/tests/*.test.ts` for a cross-cutting utility that isn't a module (e.g. `src/utils/tests/apiResponse.test.ts`, `src/tests/index.test.ts`).
- **Integration tests** live at the workspace root: `__tests__/<feature>/*.test.ts`, using Supertest against the exported `app` from `src/app.ts` — exercise the full request/response cycle including middleware.
- Both globs (`src/**/tests/**/*.test.ts`, `__tests__/**/*.test.ts`) are registered in `vitest.config.ts`'s `test.include`. `test.env` there also injects placeholder `MONGODB_URI`/`ADMIN_API_KEY` values for the whole run, since `src/config/env.ts`'s `zod` schema would otherwise throw before any test file even loads — no test opens a real MongoDB connection; `connectDB` is mocked wherever `bootstrap()` is exercised.
- **Coverage**: `npm run test:coverage --workspace backend` (v8 provider, text + HTML reporters, configured in `vitest.config.ts`'s `test.coverage`). No enforced threshold yet — reporting only, per Issue #3's scope; a coverage gate lands once real features (not just the skeleton) exist to measure.
