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

`src/app.ts` exports the configured Express app without calling `.listen()` — `src/index.ts` is the only file that binds a port, so Supertest can import `app` directly for integration tests without a live server.

## Current file tree

```
backend/
├── package.json           # name "backend", type "commonjs"; scripts: build (tsc), dev (tsx watch), test (vitest run)
├── tsconfig.json            # extends ../tsconfig.base.json
├── vitest.config.ts           # node environment; include src/**/tests/**/*.test.ts and __tests__/**/*.test.ts
├── .env.example                 # PORT, NODE_ENV, MONGODB_URI
│
├── __tests__/
│   └── health/
│       └── health.api.test.ts    # Supertest, full app, GET /health + 404 path
│
└── src/
    ├── index.ts                    # app.listen(env.PORT, ...)
    ├── app.ts                       # express instance, mounts routes/index.ts + error middleware
    │
    ├── config/
    │   ├── env.ts                    # PORT, NODE_ENV from process.env (via dotenv/config)
    │   └── db.ts                      # connectDB() stub — no mongoose import yet; real connection lands M2
    │
    ├── routes/
    │   └── index.ts                    # imports each module's .module.ts, mounts it
    │
    ├── middleware/
    │   ├── notFound.ts
    │   └── errorHandler.ts
    │
    ├── utils/
    │   └── AppError.ts
    │
    ├── externalService/                # empty — third-party API clients (Razorpay, Cloudinary, ...) land M6+
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

- `src/config/env.ts` reads `PORT` (default `4000`) and `NODE_ENV` (default `"development"`) from `process.env`, loaded via `import "dotenv/config"`. No schema validation yet (no `zod` dependency in this workspace yet).
- `src/config/db.ts` exports `connectDB()` as a no-op stub — not called anywhere yet. M2 (Product Catalog) replaces it with a real Mongoose connection and wires the call into `src/index.ts`'s startup.

## Path aliases

`tsconfig.json`'s `paths` maps `@/*` → `src/*`. Use it for imports that would otherwise need `../` parent traversal; same-directory or one-level-down imports stay relative. This is a single source of truth resolved three different ways at runtime/build time:

- `tsc` (build) doesn't rewrite aliases when emitting JS, so `tsc-alias` runs immediately after it in the `build` script, rewriting `@/...` in `dist/` back to relative paths.
- `tsx` (dev) resolves `tsconfig.json`'s `paths` natively — no extra tooling.
- Vitest resolves them via the `vite-tsconfig-paths` plugin in `vitest.config.ts`, reading the same `tsconfig.json` rather than a hand-duplicated alias map. (There is no native `resolve.tsconfigPaths` option in Vite/Vitest — this doc previously claimed otherwise, which left `__tests__/health/health.api.test.ts` failing to resolve `@/app` until Issue #8 fixed it. `buyer-app`/`admin-app` use the same plugin, for the same reason.)

## Testing

- **Unit tests** colocate inside each module: `src/modules/<feature>/tests/*.test.ts`. Test the module's own logic (service functions) in isolation.
- **Integration tests** live at the workspace root: `__tests__/<feature>/*.test.ts`, using Supertest against the exported `app` from `src/app.ts` — exercise the full request/response cycle including middleware.
- Both globs are registered in `vitest.config.ts`'s `test.include`.
- **Coverage**: `npm run test:coverage --workspace backend` (v8 provider, text + HTML reporters, configured in `vitest.config.ts`'s `test.coverage`). No enforced threshold yet — reporting only, per Issue #3's scope; a coverage gate lands once real features (not just the skeleton) exist to measure.
