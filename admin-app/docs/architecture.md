# admin-app — architecture

Implementation-level detail for `admin-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.2 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` holds just the `BrowserRouter` entry point; the actual `react-router` route declarations live in `src/router/` (there's no file-system router here). Actual UI/logic lives in `src/features/<feature>/`. Cross-cutting page chrome that isn't owned by any single feature lives in `src/layout/`:

```
src/
├── app/
│   └── App.tsx                # BrowserRouter wrapper — renders AppRoutes
├── router/
│   └── AppRoutes.tsx             # Routes tree — AdminShell layout route wrapping every page below
├── layout/
│   ├── AdminShell.tsx          # composes Sidebar + Header + MainSection
│   ├── Sidebar.tsx                # dark full-height nav — brand mark + real catalog nav items
│   ├── Header.tsx                 # top bar — search, notification/theme icons, user info
│   └── MainSection.tsx              # <main> wrapper rendering <Outlet />, page-level padding
├── features/
│   ├── dashboard/Dashboard.tsx        # "/" — catalog stat cards (placeholder data)
│   ├── products/ProductsPlaceholder.tsx        # "/products"
│   ├── categories/CategoriesPlaceholder.tsx    # "/categories"
│   ├── brands/BrandsPlaceholder.tsx            # "/brands"
│   ├── specifications/SpecificationsPlaceholder.tsx # "/specifications"
│   └── variant-types/VariantTypesPlaceholder.tsx    # "/variant-types"
├── main.tsx                    # Vite entry — mounts <App /> into #root
└── index.css                     # @import "tailwindcss"; + design-token @theme block
```

Each nav destination in `Sidebar.tsx` is a real route rendering a placeholder page, not a dead link — the same "coming soon" idiom the first placeholder (`LandingPlaceholder`, now superseded by `Dashboard`) established, kept consistent across every future screen until its real implementation lands.

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
│   └── mocks/{handlers.ts,server.ts}          # shared MSW server, extended by later feature tests
└── src/
    ├── main.tsx
    ├── index.css
    ├── app/App.tsx
    ├── router/AppRoutes.tsx
    ├── layout/{AdminShell.tsx,Sidebar.tsx,Header.tsx,MainSection.tsx}
    └── features/{dashboard,products,categories,brands,specifications,variant-types}/*.tsx
```

## Config

- **TypeScript**: split into `tsconfig.app.json` (app code — `moduleResolution: "bundler"`, DOM lib, `jsx: "react-jsx"`, `@/*` → `./src/*`) and `tsconfig.node.json` (covers `vite.config.ts`), referenced from the root `tsconfig.json` solution file — the standard Vite project-reference shape. Deliberately does **not** `extends: "../tsconfig.base.json"`, same reasoning as `buyer-app` (see `buyer-app/docs/architecture.md`): that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Vite/React need. `tsconfig.app.json`'s `include` covers `src`, `__tests__`, **and** `vitest.setup.ts` — not just `src` — because both `vite-tsconfig-paths` (needs `__tests__/*.tsx` covered to resolve `@/*` from test files) and `tsc -b`'s type-check (needs `vitest.setup.ts` in the same program for `@testing-library/jest-dom/vitest`'s global `Assertion` augmentation to apply to `__tests__/app.test.tsx`) require it — both were missed on the first pass and surfaced as real `npm run test`/`npm run build` failures, not just theoretical gaps.
- **Path aliases**: `@/*` → `./src/*` is resolved by the `vite-tsconfig-paths` plugin in `vite.config.ts`, for both dev and build. This is a deliberate difference from `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` — that option is **not real** (Vite silently ignores it; confirmed while fixing `buyer-app`'s Vitest config in Issue #5), so it's never used here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via the `@tailwindcss/vite` plugin in `vite.config.ts` and a single `@import "tailwindcss";` in `src/index.css` — the Vite-native equivalent of `buyer-app`'s PostCSS-based `@tailwindcss/postcss` wiring. `src/index.css` also carries the `@theme` design-token block — see `docs/design-tokens.md`.
- **Icons**: `react-icons`, using its `lu` (Lucide) icon set exclusively (`react-icons/lu`) for a consistent line-icon style across `Sidebar`, `Header`, and `Dashboard`.
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
