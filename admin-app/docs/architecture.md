# admin-app — architecture

Implementation-level detail for `admin-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.2 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (explicit `react-router` route declarations, since there's no file-system router here) plus top-level provider composition. Actual UI/logic lives in `src/features/<feature>/`:

```
src/
├── app/
│   └── App.tsx              # Provider(store) > BrowserRouter > AdminKeyGate > Routes — renders LandingPlaceholder at "/"
├── config/
│   └── env.ts                  # API_URL / ADMIN_API_BASE_URL, read from VITE_API_URL (falls back to http://localhost:4000)
├── store/
│   ├── authSlice.ts               # adminKey state, sessionStorage-backed
│   ├── api.ts                      # RTK Query createApi + X-Admin-Key header + 401 guard — see AGENTS.md
│   └── store.ts                     # configureStore + createStore() factory (for isolated test stores)
├── features/
│   ├── adminKey/
│   │   ├── AdminKeyGate.tsx        # blocks all routes until an admin key is set
│   │   └── AdminKeyPrompt.tsx        # the key-entry form itself
│   ├── uploads/
│   │   └── uploadsApi.ts            # presignUpload mutation + putFileToPresignedUrl (direct-to-R2 PUT), shared across features
│   ├── brands/
│   │   ├── brandsApi.ts               # injectEndpoints: getBrands/createBrand/updateBrand/updateBrandStatus/deleteBrand
│   │   ├── types.ts                     # Brand / BrandListItem / Create·UpdateBrandInput
│   │   ├── BrandsPage.tsx                 # routed at /brands — owns list-vs-form selection state
│   │   ├── BrandList.tsx                    # table + search + inline delete-guard + status toggle
│   │   ├── BrandForm.tsx                      # create/edit form (no status field — see AGENTS.md)
│   │   └── LogoUploader.tsx                     # presign → PUT-to-R2 → preview
│   ├── categories/
│   │   ├── categoriesApi.ts                       # injectEndpoints: getCategories/createCategory/updateCategory/updateCategoryStatus/deleteCategory
│   │   ├── types.ts                                 # Category / CategoryListItem / Create·UpdateCategoryInput
│   │   ├── CategoriesPage.tsx                         # routed at /categories — also fetches the unfiltered list for the parent picker
│   │   ├── CategoryList.tsx                             # flat indented tree (↳ + Parent column) + inline combined delete-guard + status toggle
│   │   ├── CategoryForm.tsx                               # create/edit form incl. parent <select>, sortOrder, meta fields
│   │   └── ImageUploader.tsx                                # presign → PUT-to-R2 → preview (purpose: "category-image")
│   ├── categorySpecifications/
│   │   ├── categorySpecificationsApi.ts                   # injectEndpoints: getCategorySpecifications/replaceCategorySpecifications (PUT)/patchCategorySpecifications (PATCH)
│   │   ├── types.ts                                         # SpecificationField/Group, CategorySpecificationsView, SpecPatchOperation (mirrors backend's union)
│   │   ├── CategorySpecificationsPage.tsx                     # routed at /specifications — in-page category <select>, mounts the editor with key={categoryId}
│   │   ├── CategorySpecificationEditor.tsx                      # draft groups[] state, Save schema (PUT), persisted-vs-local dispatch for rename/delete/filterable-toggle
│   │   └── SpecificationGroupCard.tsx                              # one group's field table — type-dependent inputs, move up/down, delete
│   ├── categoryVariants/
│   │   ├── categoryVariantsApi.ts                         # injectEndpoints: getCategoryVariants/replaceCategoryVariants (PUT)/patchCategoryVariants (PATCH)
│   │   ├── types.ts                                         # VariantAxis/Option, CategoryVariantsView, VariantAxisPatchOperation (mirrors backend's union)
│   │   ├── CategoryVariantsPage.tsx                           # routed at /variant-types — same in-page category <select> pattern as specifications
│   │   ├── CategoryVariantEditor.tsx                            # draft axes[] state, Save axes (PUT), no in-use guard on delete
│   │   └── VariantAxisRow.tsx                                     # one axis's row — type-dependent options editor, no group nesting
│   └── landing/
│       └── LandingPlaceholder.tsx  # first feature — static placeholder content, now links to /brands and /categories
├── main.tsx                    # Vite entry — mounts <App /> into #root
├── vite-env.d.ts                 # /// <reference types="vite/client" /> — needed for import.meta.env typing
└── index.css                     # @import "tailwindcss";
```

See `AGENTS.md` for the full `app/` vs `features/` convention, and its Redux/RTK Query section for the `src/store/` and `src/features/adminKey/` internals.

## Current file tree

```
admin-app/
├── package.json          # name "admin-app"; scripts: dev, build, lint, preview, test
├── .env.example             # VITE_API_URL=http://localhost:4000
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
│   ├── app.test.tsx                        # renders src/app/App.tsx, seeds an admin key first, asserts placeholder content
│   ├── mocks/{handlers.ts,server.ts}          # shared MSW server, extended by later feature tests
│   ├── utils/renderWithStore.tsx              # Provider-wrapped render helper using an isolated createStore()
│   ├── store/{authSlice.test.ts,api.test.ts}    # authSlice reducers + sessionStorage sync; X-Admin-Key header + 401 guard
│   └── features/
│       ├── adminKey/AdminKeyGate.test.tsx         # prompt-vs-children gating, key-submission round trip
│       ├── brands/BrandsPage.test.tsx               # list/create/edit/delete-guard/status-toggle/search/logo-upload
│       ├── categories/CategoriesPage.test.tsx         # tree render, all 4 hierarchy errors, combined delete-guard, status/search
│       ├── categorySpecifications/CategorySpecificationsPage.test.tsx  # synthetic-empty render, full-replace PUT, each PATCH op, in-use guard (field + group)
│       └── categoryVariants/CategoryVariantsPage.test.tsx        # synthetic-empty render, full-replace PUT, unguarded deleteAxis, updateAxis toggle, options visibility
└── src/
    ├── main.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── config/env.ts
    ├── store/{authSlice.ts,api.ts,store.ts}
    ├── app/App.tsx
    └── features/{adminKey/{AdminKeyGate.tsx,AdminKeyPrompt.tsx},uploads/uploadsApi.ts,brands/{brandsApi.ts,types.ts,BrandsPage.tsx,BrandList.tsx,BrandForm.tsx,LogoUploader.tsx},categories/{categoriesApi.ts,types.ts,CategoriesPage.tsx,CategoryList.tsx,CategoryForm.tsx,ImageUploader.tsx},categorySpecifications/{categorySpecificationsApi.ts,types.ts,CategorySpecificationsPage.tsx,CategorySpecificationEditor.tsx,SpecificationGroupCard.tsx},categoryVariants/{categoryVariantsApi.ts,types.ts,CategoryVariantsPage.tsx,CategoryVariantEditor.tsx,VariantAxisRow.tsx},landing/LandingPlaceholder.tsx}
```

## Config

- **TypeScript**: split into `tsconfig.app.json` (app code — `moduleResolution: "bundler"`, DOM lib, `jsx: "react-jsx"`, `@/*` → `./src/*`) and `tsconfig.node.json` (covers `vite.config.ts`), referenced from the root `tsconfig.json` solution file — the standard Vite project-reference shape. Deliberately does **not** `extends: "../tsconfig.base.json"`, same reasoning as `buyer-app` (see `buyer-app/docs/architecture.md`): that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Vite/React need. `tsconfig.app.json`'s `include` covers `src`, `__tests__`, **and** `vitest.setup.ts` — not just `src` — because both `vite-tsconfig-paths` (needs `__tests__/*.tsx` covered to resolve `@/*` from test files) and `tsc -b`'s type-check (needs `vitest.setup.ts` in the same program for `@testing-library/jest-dom/vitest`'s global `Assertion` augmentation to apply to `__tests__/app.test.tsx`) require it — both were missed on the first pass and surfaced as real `npm run test`/`npm run build` failures, not just theoretical gaps.
- **Path aliases**: `@/*` → `./src/*` is resolved by the `vite-tsconfig-paths` plugin in `vite.config.ts`, for both dev and build. This is a deliberate difference from `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` — that option is **not real** (Vite silently ignores it; confirmed while fixing `buyer-app`'s Vitest config in Issue #5), so it's never used here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via the `@tailwindcss/vite` plugin in `vite.config.ts` and a single `@import "tailwindcss";` in `src/index.css` — the Vite-native equivalent of `buyer-app`'s PostCSS-based `@tailwindcss/postcss` wiring.
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
- Copy `.env.example` to `.env` before running locally (`VITE_API_URL`) — `src/config/env.ts` falls back to `http://localhost:4000` if unset, so this step is optional for local dev against the default backend port, unlike `backend`'s `env.ts`, which throws on a missing required var.
