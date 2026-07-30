# TechCart context

This is the `admin-app` workspace of a monorepo. Root-level decisions (monorepo layout, shared tooling, error contract, auth) live in root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those. Implementation detail for this workspace specifically is in [`docs/architecture.md`](docs/architecture.md).

## Feature-based structure

- `src/app/` is routing only — thin files that set up `react-router` and render from `src/features/<feature>/`. Unlike `buyer-app`'s Next.js file-system router, routes here are declared explicitly in `src/app/App.tsx`.
- `src/features/<feature>/` holds the actual UI/logic for that feature. `src/features/landing/LandingPlaceholder.tsx` is the current worked example, rendered at `/` by `src/app/App.tsx`.
- This mirrors `backend/src/modules/<feature>/` and `buyer-app/src/features/<feature>/`'s feature-based organization (see `backend/AGENTS.md`, `buyer-app/AGENTS.md`), adapted for React Router instead of a file-system router.
- `src/layout/` holds cross-cutting page chrome that every route mounts inside (e.g. `AdminShell.tsx` — sidebar + header + content, rendering child routes via `<Outlet />`) — kept separate from `src/features/<feature>/` because it isn't owned by any single feature, the same way `backend/src/middleware/` and `backend/src/utils/` sit alongside (not inside) `backend/src/modules/` for non-feature code.
- Screen-level design reference: [`mock-ui/`](../mock-ui/) — static wireframes per feature's SRS doc, not a workspace of its own. Consult it before building a feature's UI.

## Testing

- Stack: Vitest (`environment: "jsdom"`) + React Testing Library + MSW, wired via `vitest.config.ts` + `vitest.setup.ts` — same shape as `buyer-app` (see `buyer-app/AGENTS.md`). Reuses the `@vitejs/plugin-react` and `vite-tsconfig-paths` devDependencies already present for the app's own `vite.config.ts`.
- Test files live in `__tests__/` at the workspace root, e.g. `__tests__/app.test.tsx`, which renders `App` directly since `src/app/App.tsx` _is_ the router here (unlike `buyer-app`, which has Next's routing external to the page component).
- The shared MSW server lives at `__tests__/mocks/server.ts` (built from `__tests__/mocks/handlers.ts`) and is started/stopped once for the whole run via `vitest.setup.ts`. New feature tests that need to mock a request add handlers to `handlers.ts`, or call `server.use(...)` inside the test itself for a one-off override.
- `npm run test --workspace admin-app` runs the suite once (`vitest run`, not watch mode).

### What to test at each layer

- **Utilities** (pure functions — formatters, validators, helpers): plain Vitest unit tests, no RTL/MSW involved. Live in `__tests__/` mirroring the source path (e.g. `src/features/catalog/format-price.ts` → `__tests__/catalog/format-price.test.ts`), asserting input/output pairs directly.
- **Form data / client-side validation**: per root `CLAUDE.md`, `admin-app` owns its own validation independent of the backend's Zod schemas (no shared validation package) — so it needs its own coverage. Validation logic gets unit tests asserting both accepted and rejected inputs and the exact error message shown per field, tested standalone from component rendering.
- **Custom API hooks** (data-fetching hooks, e.g. a future `useProducts`): tested with RTL's `renderHook`, backed by the shared MSW server. Cover the loading → success and loading → error transitions using `server.use(...)` per-test overrides.
- **Integration tests — page-wise rendering**: one test per page/route, rendering the full route through `<App />` (or a `MemoryRouter` pointed at that path) with MSW mocking every API call the page makes, asserting the rendered result matches its `mock-ui/admin-app/*.html` reference (key content present, no stray loading/error state). `__tests__/shell.test.tsx` is the first instance of this pattern; every future screen (`product-list`, `product-form`, `category-list`, ...) follows it.
