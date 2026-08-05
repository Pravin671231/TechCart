<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## TechCart context

This is the `buyer-app` workspace of a monorepo. Root-level decisions (monorepo layout, shared tooling, error contract, auth) live in root [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and [`docs/architecture.md`](../docs/architecture.md) — nothing here overrides those. Implementation detail for this workspace specifically is in [`docs/architecture.md`](docs/architecture.md).

## Feature-based structure

- `src/app/` is routing only — thin files that import and render from `src/features/<feature>/`. Next's file-system router requires `app/` for routes; that's the only thing that belongs there.
- `src/features/<feature>/` holds the actual UI/logic for that feature. `src/features/home/HomeContent.tsx` is the current worked example, rendered by `src/app/page.tsx`.
- This mirrors `backend/src/modules/<feature>/`'s feature-based organization (see `backend/AGENTS.md`), adapted for Next's routing constraints — named `features` here rather than `modules`, since this is a different framework with its own conventions.
- Screen-level design reference: [`mock-ui/`](../mock-ui/) — static wireframes per feature's SRS doc, not a workspace of its own. Consult it before building a feature's UI.
- Brand tokens (`primary`/`accent` color scales, `Inter` as `font-sans`) are wired into `src/app/globals.css` via a Tailwind `@theme` block. [`mock-ui/brand-kit.html`](../mock-ui/brand-kit.html) is the visual reference; `globals.css` is the source of truth if they ever drift.

## State management (`src/store/`)

- `src/store/` (Issue #71 / M2.14) is a third top-level `src/` directory, peer to `app/` and `features/` — Redux Toolkit + RTK Query infrastructure shared by every feature, not a feature itself. See `docs/architecture.md`'s "State management / data fetching" section for full detail on the envelope-unwrap/error-normalization design and the env fail-loud mechanics.
- `src/store/api.ts` defines **no endpoints of its own** (`endpoints: () => ({})`) and only `tagTypes: ["Product", "Category"]`. Add new endpoints via `api.injectEndpoints({...})` inside the owning feature's own `src/features/<feature>/api.ts` — never by editing `src/store/api.ts` directly, except to extend its own `baseQuery`/`meta` machinery (e.g. Issue #72 / M2.15 threaded `pagination` through via `meta` once a real list endpoint needed it).
- `NEXT_PUBLIC_API_URL` (`src/store/env.ts`) fails the build/dev-server loudly if unset — copy `.env.example` to `.env.local` and fill it in before running `dev`/`build`/`test` locally that need a real backend.
- `src/features/products/` (Issue #72 / M2.15) is the shared, cross-screen product-listing feature — `ProductCard`, `ProductGrid`, `Pagination`, `SortSelect`, and the loading/empty/error state components all live here, plus `api.ts` (the `getProducts` endpoint) and `types.ts` (matching `backend`'s `PublicProductListItem` exactly). `src/features/home/` only composes these into the home screen's toolbar/grid/pagination layout — later listing screens (category, search) are expected to reuse this feature's components/hooks rather than duplicating them.

## Testing

- Stack: Vitest (`environment: "jsdom"`) + React Testing Library + MSW, wired via `vitest.config.ts` + `vitest.setup.ts`. Path aliases (`@/*`) resolve via the `vite-tsconfig-paths` plugin — `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` is not a real Vite/Vitest option (confirmed by reproducing the failure there), so it isn't mirrored here.
- Test files live in `__tests__/` at the workspace root (not colocated inside `src/`), e.g. `__tests__/home.test.tsx`, `__tests__/store/api.test.ts`.
- The shared MSW server lives at `__tests__/mocks/server.ts` (built from `__tests__/mocks/handlers.ts`) and is started/stopped once for the whole run via `vitest.setup.ts`. New feature tests that need to mock a request add handlers to `handlers.ts`, or call `server.use(...)` inside the test itself for a one-off override.
- A component using RTK Query hooks needs a manual `<Provider store={makeStore()}>` wrapper (`@/store/store`) when rendered directly with RTL — `layout.tsx`'s `StoreProvider` isn't part of the tree for a component rendered in isolation from its route.
- `npm run test --workspace buyer-app` runs the suite once (`vitest run`, not watch mode).
