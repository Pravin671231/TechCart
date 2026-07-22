# AGENTS.md (backend)

Guidance for AI coding agents working in `backend/`. Root-level architecture decisions live in the root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those.

## Current status

Module-based skeleton scaffolded (Issue #2 / M0.2): Express 5 + TypeScript, cross-cutting `src/config/`, `src/middleware/`, `src/utils/`, `src/externalService/`, `src/routes/` (aggregator), and one feature module, `src/modules/health/`. Vitest + Supertest are wired with passing tests. `npm run build|dev|test --workspace backend` all work. No `mongoose`/`zod` dependency yet — `src/config/db.ts` is a stub; a real Mongoose connection lands with M2 Product Catalog.

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

## Dev workflow

- `npm run dev --workspace backend` — `tsx watch src/index.ts`
- `npm run build --workspace backend` — `tsc && tsc-alias`, must produce zero errors
- `npm run test --workspace backend` — `vitest run`
- `npm run test:coverage --workspace backend` — `vitest run --coverage` (v8 provider, text + HTML reporters; no enforced threshold yet)
- Copy `.env.example` to `.env` before running locally (`PORT`, `NODE_ENV`, `MONGODB_URI`)

Test files: colocated `src/modules/<feature>/tests/*.test.ts` for unit tests, workspace-root `__tests__/<feature>/*.test.ts` for Supertest integration tests. Both globs are wired in `vitest.config.ts`.

## Current module inventory

- `health` — `GET /health`, no DB access, reference implementation for the module pattern above.
