# AGENTS.md (backend)

This file covers `backend/` implementation detail only. Root-level architecture decisions live in the root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those.

## Current status

Module-based skeleton scaffolded (Issue #2 / M0.2): Express 5 + TypeScript, cross-cutting `src/config/`, `src/middleware/`, `src/utils/`, `src/externalService/`, `src/routes/` (aggregator), and one feature module, `src/modules/health/`. Vitest + Supertest are wired with passing tests. `npm run build|dev|test --workspace backend` all work. M2 core plumbing is in place (Issue #25 / M2.1): `src/config/db.ts` holds a live Mongoose connection (plus `disconnectDB()` for graceful shutdown), started from `src/index.ts`'s exported `startServer()` (refuses to call `app.listen()` and exits `1` if `connectDB()` rejects — see Startup below); `src/config/env.ts` validates `process.env` with a `zod` schema (first `zod` usage in this workspace); `src/utils/apiResponse.ts`'s `successResponse()` is the shared `{ success: true, data }` (+ optional `pagination`) envelope every later catalog controller uses; `src/middleware/adminAuth.ts` + `src/routes/admin.routes.ts` gate everything mounted under `/api/admin` behind an `X-Admin-Key` header check — see Admin routes below.

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
- `src/middleware/errorHandler.ts` — 4-arg Express error middleware. `AppError` instances → `{ success:false, code, message }` at `err.statusCode`; anything else → 500 `{ success:false, code:"INTERNAL_ERROR", message:"Internal server error" }`. Never leaks `err.stack`.
- `src/middleware/notFound.ts` — catch-all for unmatched routes → 404 `{ success:false, code:"NOT_FOUND", message:"Route not found" }`.

Both are mounted in `src/app.ts`, after all routes.

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

## Startup

`src/index.ts` exports an async `startServer()`: it awaits `connectDB()` first — on rejection it logs the error and calls `process.exit(1)` **without** calling `app.listen()`, so the process never silently serves traffic against a dead DB connection; only on success does it call `app.listen(env.PORT, ...)`. The unconditional call at the bottom of the file is guarded with `if (require.main === module) startServer();`, so requiring/importing `index.ts` (e.g. from a test) doesn't trigger a real startup as a side effect — only running it directly (`node`/`tsx src/index.ts`, which is what `npm run dev`/the compiled `dist/index.js` do) does. This is what makes the failure path unit-testable — see `src/tests/index.test.ts`, which imports `{ startServer }` and mocks `connectDB`.

## Dev workflow

- `npm run dev --workspace backend` — `tsx watch src/index.ts`
- `npm run build --workspace backend` — `tsc && tsc-alias`, must produce zero errors
- `npm run test --workspace backend` — `vitest run`
- `npm run test:coverage --workspace backend` — `vitest run --coverage` (v8 provider, text + HTML reporters; no enforced threshold yet)
- Copy `.env.example` to `.env` before running locally (`PORT`, `NODE_ENV`, `MONGODB_URI`, `ADMIN_API_KEY`) — `src/config/env.ts` validates all of these with `zod` at import time and throws immediately if any required value is missing, so a misconfigured `.env` fails on startup rather than partway through a request.
- `env.ts` loads env files by mode: `.env.${NODE_ENV}` first, then `.env` fills in anything not already set (dotenv never overwrites an existing `process.env` key). So `.env.development`/`.env.test`/`.env.production` are optional per-mode overrides layered on top of the shared `.env` — a missing mode-specific file is a silent no-op, not an error. All of them are gitignored; only `.env.example` is committed.
- Tests don't need a real `.env`: `vitest.config.ts`'s `test.env` injects dummy `MONGODB_URI`/`ADMIN_API_KEY` values directly into `process.env` for the whole run (Vitest also sets `NODE_ENV=test` itself, so `env.ts` would look for `.env.test` too — it doesn't need to exist, since the injected values already satisfy the `zod` schema before `dotenv.config()` would matter). Nothing in the test suite opens a real MongoDB connection; `connectDB` is mocked wherever it's exercised.

Test files: colocated `src/modules/<feature>/tests/*.test.ts` (or `src/<area>/tests/*.test.ts` for cross-cutting utilities, e.g. `src/utils/tests/apiResponse.test.ts`, `src/tests/index.test.ts`) for unit tests, workspace-root `__tests__/<feature>/*.test.ts` for Supertest integration tests. Both globs are wired in `vitest.config.ts`.

## Current module inventory

- `health` — `GET /health`, no DB access, reference implementation for the module pattern above.
- No catalog feature modules exist yet — Issue #25 (M2.1) only established the `/api/admin` router, the guard, the envelope helper, and the live DB connection that they all depend on. Issues #26–#36 mount their modules under `adminRouter` (admin-side) or the root router (buyer-facing) as they land.
