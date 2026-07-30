# admin-app — architecture

Implementation-level detail for `admin-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.2 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` holds just the `BrowserRouter` entry point; the actual `react-router` route declarations live in `src/router/` (there's no file-system router here). Actual UI/logic lives in `src/features/<feature>/`. Cross-cutting page chrome that isn't owned by any single feature lives in `src/layout/`. Generic reusable UI widgets that aren't page chrome and aren't feature-specific live in `src/components/`:

```
src/
├── app/
│   └── App.tsx                # BrowserRouter wrapper — renders AppRoutes
├── router/
│   └── AppRoutes.tsx             # Routes tree — AdminShell layout route wrapping every page below
├── layout/
│   ├── AdminShell.tsx          # composes Sidebar + Header + MainSection
│   ├── Sidebar.tsx                # dark full-height nav — Dashboard link + collapsible "Product Catalog" group
│   ├── Header.tsx                 # top bar — search, notification/theme icons, user info
│   ├── MainSection.tsx              # <main> wrapper rendering <Outlet />, page-level padding
│   └── PageHeader.tsx                 # reusable breadcrumb + title (<h1>) + top-right action button
├── components/
│   ├── DataTable.tsx           # generic <T,> Material React Table wrapper, MUI theme scoped here only
│   ├── muiTheme.ts                # MUI theme matched to the Tailwind design tokens — DataTable-only
│   └── StatusBadge.tsx            # { label, tone } pill, tone → success/warning/danger/neutral tokens
├── features/
│   ├── dashboard/Dashboard.tsx        # "/" — catalog stat cards (placeholder data)
│   └── product-catalog/                 # every screen SRS v0.2 (Product Catalog) covers
│       ├── products/                                # "/product-catalog/products"
│       │   ├── ProductsPage.tsx                        # low-stock toggle + DataTable (search/filter/sort/pagination/selection built in)
│       │   └── mockProducts.ts                           # Product type + mock rows
│       ├── categories/                              # "/product-catalog/categories"
│       │   ├── CategoriesPage.tsx                      # DataTable (two-level indent)
│       │   └── mockCategories.ts                         # Category type + mock rows
│       ├── brands/                                  # "/product-catalog/brands"
│       │   ├── BrandsPage.tsx                          # DataTable
│       │   └── mockBrands.ts                             # Brand type + mock rows
│       ├── specifications/SpecificationsPlaceholder.tsx # "/product-catalog/specifications"
│       └── variant-types/VariantTypesPlaceholder.tsx    # "/product-catalog/variant-types"
├── main.tsx                    # Vite entry — mounts <App /> into #root
└── index.css                     # @import "tailwindcss"; + design-token @theme block
```

Each nav destination in `Sidebar.tsx` is a real route rendering a placeholder page, not a dead link — the same "coming soon" idiom the first placeholder (`LandingPlaceholder`, now superseded by `Dashboard`) established, kept consistent across every future screen until its real implementation lands. `product-catalog/` groups every one of those placeholders under the SRS feature they belong to (`docs/srs/features/0.2-product-catalog.md`), separate from `dashboard/`, which isn't part of that SRS feature — and `AppRoutes.tsx` nests their URLs under `/product-catalog/*` to match, rather than leaving the file grouping and the URL structure out of sync. `Sidebar.tsx` mirrors the same grouping one level further: the five product-catalog links sit behind a collapsible "Product Catalog" toggle (local `useState`, defaulting open when the current route is already under `/product-catalog`), rather than as flat top-level items.

`ProductsPage.tsx`, `CategoriesPage.tsx`, and `BrandsPage.tsx` are the placeholders promoted to real (mock-data) content — per root `docs/architecture.md` §4.2's tech blueprint, all three render mock data through the shared `DataTable`, backed by **Material React Table** (search, per-column filters, sorting, pagination, and toolbar-level column visibility all built in, rather than hand-built — see `docs/design-tokens.md`'s design-tokens note and `muiTheme.ts`). MRT also ships row-selection checkboxes and a per-column "⋮" actions menu; both are explicitly disabled (`enableRowSelection: false`, `enableColumnActions: false` in `DataTable.tsx`) — not part of this app's UI. Each composes the shared `PageHeader` rather than `MainSection.tsx` owning that chrome directly, because `MainSection` wraps every route including `Dashboard`, whose header shape (stat cards) is entirely different — `PageHeader` is the reusable piece, used per-page, not baked into the universal wrapper. `DataTable`/`StatusBadge` live in `src/components/`, not `src/layout/`, because they're generic reusable widgets, not page-layout chrome — same distinction as keeping `AdminShell`/`Sidebar` out of `src/features/`. There's no backend list endpoint wired into `admin-app` yet (that's a separate TanStack Query integration) — each page simulates a brief loading delay (`isLoading` state, ~500ms `setTimeout` on mount) so `DataTable`'s skeleton/spinner states are genuinely exercised rather than left as unused props. Products additionally keeps one small piece of custom state — a "low stock only" checkbox — since that's a derived cross-field filter (`stock <= lowStockThreshold`) MRT has no native column concept for; everything else (search, the Status column's filter, sorting, pagination, column visibility) is MRT's built-in toolbar. Specifications/Variant Types stay plain placeholders, and none of the three real pages include the inline create/edit form panel shown in their mocks — that's a separate, larger feature.

Right-aligned numeric columns (`sellingPrice`/`stock` in `ProductsPage.tsx`, `productCount`/`sortOrder` in `CategoriesPage.tsx`, `productCount` in `BrandsPage.tsx`) use the shared `rightAlignedHeadCellProps` (`src/components/tableCellProps.ts`) as their `muiTableHeadCellProps`, instead of a plain `{ align: "right" }`. MRT reverses the flex direction of *both* the header cell's content row and its label+sort-icon row when `align: "right"`, which puts the sort icon before the label — `rightAlignedHeadCellProps` overrides just the inner label row back to normal order so the icon stays after the label while the group still anchors right. `tableCellProps.ts` is a separate file from `DataTable.tsx` because Vite's Fast Refresh requires component files to only export components.

**MUI stays scoped to `DataTable.tsx`.** Material React Table pulls in `@mui/material`/`@mui/icons-material`/`@emotion/react`/`@emotion/styled` as peer dependencies — a second styling system alongside `admin-app`'s Tailwind-only setup everywhere else. `muiTheme.ts` is a custom MUI theme (primary color matched to the `#16A34A` design token, `shape.borderRadius: 8` matching `rounded-lg`) wrapped in a `<ThemeProvider>` **only** inside `DataTable.tsx` — no `CssBaseline`, no app-wide provider — so it can't leak into or reset `Sidebar`/`Header`/`PageHeader`, which stay pure Tailwind.

**Horizontal-overflow containment.** A wide table (many columns + MRT's own toolbar) can exceed the space left after the sidebar. Flexbox's default `min-width: auto` means a flex item won't shrink below its content's width unless told to — so without intervention, that width demand propagates all the way up through `MainSection`'s `<main>` and `AdminShell`'s right-column `<div>`, growing the whole page past the viewport and scrolling the fixed-width `Sidebar` out of view instead of scrolling just the table. Fixed at both ends of the chain: `AdminShell.tsx`'s right column and `MainSection.tsx`'s `<main>` both carry `min-w-0` (so they're capped at their allotted width, never grown to fit a descendant), and `DataTable.tsx` wraps its table output in a `<section data-testid="data-table-section">` with its own `min-w-0 overflow-x-auto` — the one place a horizontal scrollbar is allowed to appear. Removing `min-w-0` from any point in that chain reintroduces the bug even if the others stay in place.

See `AGENTS.md` for the full `app/` vs `features/` convention.

## Current file tree

```
admin-app/
├── package.json          # name "admin-app"; scripts: dev, build, lint, preview, test
├── tsconfig.json           # solution file — references tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json          # app + test code: bundler resolution, DOM lib, @/* → ./src/* — includes src, __tests__, vitest.setup.ts
├── tsconfig.node.json           # covers vite.config.ts
├── vite.config.ts                 # @vitejs/plugin-react, @tailwindcss/vite, vite-tsconfig-paths
├── vitest.config.ts                 # jsdom environment, @vitejs/plugin-react, vite-tsconfig-paths
├── vitest.setup.ts                    # jest-dom matchers, MSW server lifecycle, RTL cleanup
├── eslint.config.mjs                # typescript-eslint + react-hooks + react-refresh — separate from root eslint.config.ts
├── index.html                        # Vite entry HTML, mounts #root
├── AGENTS.md
├── CLAUDE.md                           # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md                  # this file
├── __tests__/
│   ├── app.test.tsx                        # renders src/app/App.tsx, asserts the Dashboard renders at "/"
│   ├── shell.test.tsx                        # renders src/app/App.tsx, asserts AdminShell sidebar/header/content
│   ├── routes.test.tsx                        # clicks each sidebar nav link, asserts the matching page heading
│   ├── products.test.tsx                      # ProductsPage: renders after simulated load, low-stock toggle filters
│   ├── categories.test.tsx                    # CategoriesPage: renders mock rows, subcategory indentation
│   ├── brands.test.tsx                        # BrandsPage: renders mock rows
│   └── mocks/{handlers.ts,server.ts}          # shared MSW server, extended by later feature tests
└── src/
    ├── main.tsx
    ├── index.css
    ├── app/App.tsx
    ├── router/AppRoutes.tsx
    ├── layout/{AdminShell.tsx,Sidebar.tsx,Header.tsx,MainSection.tsx,PageHeader.tsx}
    ├── components/{DataTable.tsx,muiTheme.ts,tableCellProps.ts,StatusBadge.tsx}
    └── features/{dashboard,product-catalog/{products/{ProductsPage.tsx,mockProducts.ts},categories/{CategoriesPage.tsx,mockCategories.ts},brands/{BrandsPage.tsx,mockBrands.ts},specifications,variant-types}}/*.tsx
```

## Config

- **TypeScript**: split into `tsconfig.app.json` (app code — `moduleResolution: "bundler"`, DOM lib, `jsx: "react-jsx"`, `@/*` → `./src/*`) and `tsconfig.node.json` (covers `vite.config.ts`), referenced from the root `tsconfig.json` solution file — the standard Vite project-reference shape. Deliberately does **not** `extends: "../tsconfig.base.json"`, same reasoning as `buyer-app` (see `buyer-app/docs/architecture.md`): that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Vite/React need. `tsconfig.app.json`'s `include` covers `src`, `__tests__`, **and** `vitest.setup.ts` — not just `src` — because both `vite-tsconfig-paths` (needs `__tests__/*.tsx` covered to resolve `@/*` from test files) and `tsc -b`'s type-check (needs `vitest.setup.ts` in the same program for `@testing-library/jest-dom/vitest`'s global `Assertion` augmentation to apply to `__tests__/app.test.tsx`) require it — both were missed on the first pass and surfaced as real `npm run test`/`npm run build` failures, not just theoretical gaps.
- **Path aliases**: `@/*` → `./src/*` is resolved by the `vite-tsconfig-paths` plugin in `vite.config.ts`, for both dev and build. This is a deliberate difference from `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` — that option is **not real** (Vite silently ignores it; confirmed while fixing `buyer-app`'s Vitest config in Issue #5), so it's never used here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via the `@tailwindcss/vite` plugin in `vite.config.ts` and a single `@import "tailwindcss";` in `src/index.css` — the Vite-native equivalent of `buyer-app`'s PostCSS-based `@tailwindcss/postcss` wiring. `src/index.css` also carries the `@theme` design-token block — see `docs/design-tokens.md`.
- **Icons**: `react-icons`, using its `lu` (Lucide) icon set exclusively (`react-icons/lu`) for a consistent line-icon style across `Sidebar`, `Header`, and `Dashboard`.
- **Tables**: `material-react-table` for catalog/order grids, per root `docs/architecture.md` §4.2 — chosen over hand-building on headless `@tanstack/react-table` because it ships filter, sort, pagination, column visibility, and loading (spinner/skeleton) states out of the box (row selection and the per-column actions menu ship too but are disabled — see above). Wrapped once by `src/components/DataTable.tsx` rather than each page building its own `useMaterialReactTable` call. Its MUI peer dependencies (`@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`) and `src/components/muiTheme.ts` are scoped to `DataTable.tsx` only — see the "MUI stays scoped" note above.
- **ESLint**: `eslint.config.mjs` uses `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (the standard Vite React-TS template set) — resolved when `eslint` runs from within `admin-app/` (e.g. `npm run lint --workspace admin-app`). The root `eslint.config.ts` still covers `admin-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — same non-conflicting layering as `buyer-app`.

## Testing

- Vitest (`environment: "jsdom"`) + React Testing Library + MSW, per root `docs/architecture.md` §8 — same shape as `buyer-app` (see `buyer-app/docs/architecture.md`). `vitest.config.ts` reuses the `@vitejs/plugin-react` and `vite-tsconfig-paths` devDependencies already installed for `vite.config.ts`, rather than adding a second copy.
- Test files live in workspace-root `__tests__/`, not colocated in `src/` — `__tests__/app.test.tsx` renders `App` directly, since `src/app/App.tsx` is itself the router (`BrowserRouter` + `Routes`), unlike `buyer-app` where Next owns routing externally to the page component.
- `__tests__/mocks/server.ts` + `handlers.ts` hold one shared MSW server, started/stopped once in `vitest.setup.ts`; later feature tests extend `handlers.ts` or call `server.use(...)` per-test rather than re-wiring MSW from scratch.
- No coverage threshold yet, matching `backend`/`buyer-app`'s "reporting only" stance.

## Dev workflow

- `npm run dev --workspace admin-app` — `vite`, serves on `http://localhost:5173`
- `npm run build --workspace admin-app` — `tsc -b && vite build`, must succeed
- `npm run lint --workspace admin-app` — `eslint .` (uses this workspace's own flat config)
- `npm run preview --workspace admin-app` — `vite preview`, serves the production build locally
- `npm run test --workspace admin-app` — `vitest run`
