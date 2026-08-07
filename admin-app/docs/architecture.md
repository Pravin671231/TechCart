# admin-app — architecture

Implementation-level detail for `admin-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.2 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (explicit `react-router` route declarations, since there's no file-system router here) plus top-level provider composition. Actual UI/logic lives in `src/features/<feature>/`. `src/components/` holds cross-feature building blocks with no domain logic, split by purpose (`ui/`, `form/`, `layout/`) rather than colocated with any one feature:

```
src/
├── App.tsx                  # top-level composition root: Provider(store) > BrowserRouter > AdminKeyGate > MainRoutes
├── app/                      # Redux/RTK Query state only — two sibling subfolders
│   ├── store/
│   │   ├── authSlice.ts           # adminKey state, sessionStorage-backed
│   │   ├── store.ts                 # configureStore + createStore() factory (for isolated test stores)
│   │   └── hooks.ts                   # useAppDispatch/useAppSelector — typed react-redux hooks
│   └── api/
│       ├── baseQuery.ts            # fetchBaseQuery config + baseQueryWithAdminKeyGuard (401 → clearAdminKey)
│       ├── baseApi.ts                # createApi instance (reducerPath, tagTypes) — every feature injectEndpoints into this
│       ├── api.types.ts                # Pagination/ApiSuccessEnvelope/ApiSuccessListEnvelope/ApiErrorEnvelope types
│       ├── apiResponse.ts                # unwrapData/unwrapList — success-response helpers
│       ├── apiError.ts                     # getApiErrorEnvelope — error-response helper
│       └── ENDPOINTS.ts                      # scaffold for centralized endpoint paths — not yet populated, feature *Api.ts files still inline their own URLs
├── routes/
│   └── mainRoutes.tsx          # MainRoutes: <Routes> tree — AppShell layout route wrapping all page routes, renders LandingPlaceholder at "/"
├── components/
│   ├── ui/                     # generic reusable primitives, no domain semantics
│   │   ├── Button.tsx             # cva() variants: primary/secondary/outline × sm/md
│   │   ├── Card.tsx                 # cva() variants: padding × tone × dashed
│   │   ├── InlineAlert.tsx            # cn() only — single-branch VARIANT_CLASS map
│   │   ├── LoadingState.tsx             # LoadingState + ErrorState, cn() only
│   │   ├── Pagination.tsx                 # cn() only, no variant map
│   │   ├── StatusBadge.tsx                  # cva() variants: tone × shape
│   │   └── Table.tsx                          # Table + TableHeadRow + EmptyRow, cn() only
│   ├── form/                   # form-input controls
│   │   ├── Checkbox.tsx           # cn() only
│   │   ├── FormField.tsx            # TextField/TextAreaField/SelectField/ReadOnlyField — ReadOnlyField uses cva()
│   │   └── SearchInput.tsx            # cn() only
│   └── layout/                 # app chrome and page structure
│       ├── AppShell.tsx           # responsive shell — desktop sidebar + mobile slide-out drawer, wraps every route via <Outlet />
│       ├── SidebarNav.tsx           # nav link list (from navItems.ts) + logout, rendered by AppShell for both desktop and mobile
│       ├── navItems.ts                # NAV_ITEMS: Dashboard/Products/Categories/Brands/Specifications/Variant types
│       └── PageHeader.tsx               # cva() variants: size (lg/md), title + actions row
├── config/
│   └── env.ts                  # API_URL / ADMIN_API_BASE_URL, read from VITE_API_URL (falls back to http://localhost:4000)
├── lib/
│   └── utils.ts                # cn() = twMerge(clsx(inputs)) — the required way to build any conditional/mergeable className app-wide
├── features/
│   ├── adminKey/
│   │   ├── AdminKeyGate.tsx        # blocks all routes until an admin key is set
│   │   └── AdminKeyPrompt.tsx        # the key-entry form itself
│   ├── uploads/
│   │   ├── uploadsApi.ts            # presignUpload mutation + putFileToPresignedUrl (direct-to-R2 PUT), shared across features
│   │   └── SingleImageUploader.tsx    # presign → PUT-to-R2 → preview, feature-agnostic (purpose param), used by both brands/ and categories/
│   ├── product-catalog/        # the 5 features that together implement the Product Catalog domain — see AGENTS.md for the grouping rationale
│   │   ├── brands/
│   │   │   ├── brandsApi.ts               # injectEndpoints: getBrands/createBrand/updateBrand/updateBrandStatus/deleteBrand
│   │   │   ├── types.ts                     # Brand / BrandListItem / Create·UpdateBrandInput
│   │   │   ├── BrandsPage.tsx                 # routed at /brands — owns list-vs-form selection state
│   │   │   ├── BrandList.tsx                    # table + search + inline delete-guard + status toggle
│   │   │   └── BrandForm.tsx                      # create/edit form (no status field — see AGENTS.md); logo upload via features/uploads/SingleImageUploader
│   │   ├── categories/
│   │   │   ├── categoriesApi.ts                       # injectEndpoints: getCategories/createCategory/updateCategory/updateCategoryStatus/deleteCategory
│   │   │   ├── types.ts                                 # Category / CategoryListItem / Create·UpdateCategoryInput
│   │   │   ├── CategoriesPage.tsx                         # routed at /categories — also fetches the unfiltered list for the parent picker
│   │   │   ├── CategoryList.tsx                             # flat indented tree (↳ + Parent column) + inline combined delete-guard + status toggle
│   │   │   └── CategoryForm.tsx                               # create/edit form incl. parent <select>, sortOrder, meta fields; image upload via features/uploads/SingleImageUploader
│   │   ├── categorySpecifications/
│   │   │   ├── categorySpecificationsApi.ts                   # injectEndpoints: getCategorySpecifications/replaceCategorySpecifications (PUT)/patchCategorySpecifications (PATCH)
│   │   │   ├── types.ts                                         # SpecificationField/Group, CategorySpecificationsView, SpecPatchOperation (mirrors backend's union)
│   │   │   ├── CategorySpecificationsPage.tsx                     # routed at /specifications — in-page category <select>, mounts the editor with key={categoryId}
│   │   │   ├── CategorySpecificationEditor.tsx                      # draft groups[] state, Save schema (PUT), persisted-vs-local dispatch for rename/delete/filterable-toggle
│   │   │   └── SpecificationGroupCard.tsx                              # one group's field table — type-dependent inputs, move up/down, delete
│   │   ├── categoryVariants/
│   │   │   ├── categoryVariantsApi.ts                         # injectEndpoints: getCategoryVariants/replaceCategoryVariants (PUT)/patchCategoryVariants (PATCH)
│   │   │   ├── types.ts                                         # VariantAxis/Option, CategoryVariantsView, VariantAxisPatchOperation (mirrors backend's union)
│   │   │   ├── CategoryVariantsPage.tsx                           # routed at /variant-types — same in-page category <select> pattern as specifications
│   │   │   ├── CategoryVariantEditor.tsx                            # draft axes[] state, Save axes (PUT), no in-use guard on delete
│   │   │   └── VariantAxisRow.tsx                                     # one axis's row — type-dependent options editor, no group nesting
│   │   └── products/
│   │       ├── productsApi.ts                                # injectEndpoints: getProducts/getProduct/updateProductStatus/updateProductStock
│   │       ├── types.ts                                         # Product (brand/category as raw ids, unpopulated) / ProductVariant / ProductSort
│   │       ├── money.ts                                           # formatPrice() — Intl.NumberFormat("en-IN", {style:"currency",currency:"INR"})
│   │       ├── ProductsPage.tsx                                     # routed at /products — owns search/status/lowStock/page state
│   │       ├── ProductList.tsx                                        # table + inline stock quick-edit + archive/restore + pagination
│   │       ├── ProductDetailPage.tsx                                    # routed at /products/:id — read-only, every field + all variants
│   │       └── productForm/
│   │           ├── ProductFormPage.tsx                                     # routed at /products/new and /products/:id/edit
│   │           ├── ProductForm.tsx                                          # basics/pricing/SEO state, orchestrates the pieces below, create-vs-update submit
│   │           ├── ProductImagesEditor.tsx                                   # 1-8 (product) or 0-2 (variant) presign-upload widget w/ primary selection
│   │           ├── ProductSpecificationsFields.tsx                           # dynamic inputs from the selected category's specification schema
│   │           ├── specificationValues.ts                                     # SpecificationValues type + specKey() — split out for react-refresh's export rule
│   │           └── ProductVariantsEditor.tsx                                   # embedded variant list/add/edit, one control per category variant axis
│   └── landing/
│       └── LandingPlaceholder.tsx  # first feature — static placeholder content, links to /brands and /categories
├── main.tsx                    # Vite entry — mounts <App /> into #root
├── vite-env.d.ts                 # /// <reference types="vite/client" /> — needed for import.meta.env typing
└── index.css                     # @import "tailwindcss";
```

See `AGENTS.md` for the full `app/` vs `routes/` vs `features/` vs `components/` convention, its `cn()`/`class-variance-authority` styling section, and its Redux/RTK Query section for the `src/app/store/`, `src/app/api/`, and `src/features/adminKey/` internals.

## Current file tree

```
admin-app/
├── package.json          # name "admin-app"; scripts: dev, build, lint, preview, test; deps incl. clsx/tailwind-merge/class-variance-authority
├── .env.example             # VITE_API_URL=http://localhost:4000
├── vercel.json                # rewrites all paths to /index.html (SPA client-side routing on Vercel)
├── tsconfig.json                # solution file — references tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json               # app + test code: bundler resolution, DOM lib, @/* → ./src/* — includes src, __tests__, vitest.setup.ts
├── tsconfig.node.json                # covers vite.config.ts
├── vite.config.ts                      # @vitejs/plugin-react, @tailwindcss/vite, vite-tsconfig-paths
├── vitest.config.ts                      # jsdom environment, @vitejs/plugin-react, vite-tsconfig-paths
├── vitest.setup.ts                         # jest-dom matchers, MSW server lifecycle, RTL cleanup
├── eslint.config.mjs                     # typescript-eslint + react-hooks + react-refresh — separate from root eslint.config.ts
├── index.html                              # Vite entry HTML, mounts #root
├── AGENTS.md
├── CLAUDE.md                                 # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md                        # this file
├── __tests__/
│   ├── app.test.tsx                              # renders src/App.tsx, seeds an admin key first, asserts placeholder content
│   ├── mocks/{handlers.ts,server.ts}                # shared MSW server, extended by later feature tests
│   ├── utils/renderWithStore.tsx                      # Provider-wrapped render helper using an isolated createStore()
│   ├── store/{authSlice.test.ts,api.test.ts}            # authSlice reducers + sessionStorage sync; X-Admin-Key header + 401 guard
│   └── features/
│       ├── adminKey/AdminKeyGate.test.tsx                 # prompt-vs-children gating, key-submission round trip
│       └── product-catalog/                                # mirrors src/features/product-catalog/'s layout
│           ├── brands/BrandsPage.test.tsx                     # list/create/edit/delete-guard/status-toggle/search/logo-upload
│           ├── categories/CategoriesPage.test.tsx               # tree render, all 4 hierarchy errors, combined delete-guard, status/search
│           ├── categorySpecifications/CategorySpecificationsPage.test.tsx  # synthetic-empty render, full-replace PUT, each PATCH op, in-use guard (field + group)
│           ├── categoryVariants/CategoryVariantsPage.test.tsx        # synthetic-empty render, full-replace PUT, unguarded deleteAxis, updateAxis toggle, options visibility
│           ├── products/ProductsPage.test.tsx                          # list+resolved names, search/status/lowStock composition, stock quick-edit, archive/restore, detail view (all variants)
│           └── products/ProductForm.test.tsx                             # SKU disabled on edit, category-change re-fetch, create+upload flow, SPECIFICATION_VALIDATION_FAILED, add-variant
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── config/env.ts
    ├── lib/utils.ts
    ├── app/{store/{authSlice.ts,store.ts,hooks.ts},api/{baseQuery.ts,baseApi.ts,api.types.ts,apiResponse.ts,apiError.ts,ENDPOINTS.ts}}
    ├── routes/mainRoutes.tsx
    ├── components/{ui/{Button.tsx,Card.tsx,InlineAlert.tsx,LoadingState.tsx,Pagination.tsx,StatusBadge.tsx,Table.tsx},form/{Checkbox.tsx,FormField.tsx,SearchInput.tsx},layout/{AppShell.tsx,SidebarNav.tsx,navItems.ts,PageHeader.tsx}}
    └── features/{adminKey/{AdminKeyGate.tsx,AdminKeyPrompt.tsx},uploads/{uploadsApi.ts,SingleImageUploader.tsx},product-catalog/{brands/{brandsApi.ts,types.ts,BrandsPage.tsx,BrandList.tsx,BrandForm.tsx},categories/{categoriesApi.ts,types.ts,CategoriesPage.tsx,CategoryList.tsx,CategoryForm.tsx},categorySpecifications/{categorySpecificationsApi.ts,types.ts,CategorySpecificationsPage.tsx,CategorySpecificationEditor.tsx,SpecificationGroupCard.tsx},categoryVariants/{categoryVariantsApi.ts,types.ts,CategoryVariantsPage.tsx,CategoryVariantEditor.tsx,VariantAxisRow.tsx},products/{productsApi.ts,types.ts,money.ts,statusPresentation.ts,ProductsPage.tsx,ProductList.tsx,ProductDetailPage.tsx,productForm/{ProductFormPage.tsx,ProductForm.tsx,ProductImagesEditor.tsx,ProductSpecificationsFields.tsx,specificationValues.ts,ProductVariantsEditor.tsx}}},landing/LandingPlaceholder.tsx}
```

## Config

- **TypeScript**: split into `tsconfig.app.json` (app code — `moduleResolution: "bundler"`, DOM lib, `jsx: "react-jsx"`, `@/*` → `./src/*`) and `tsconfig.node.json` (covers `vite.config.ts`), referenced from the root `tsconfig.json` solution file — the standard Vite project-reference shape. Deliberately does **not** `extends: "../tsconfig.base.json"`, same reasoning as `buyer-app` (see `buyer-app/docs/architecture.md`): that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Vite/React need. `tsconfig.app.json`'s `include` covers `src`, `__tests__`, **and** `vitest.setup.ts` — not just `src` — because both `vite-tsconfig-paths` (needs `__tests__/*.tsx` covered to resolve `@/*` from test files) and `tsc -b`'s type-check (needs `vitest.setup.ts` in the same program for `@testing-library/jest-dom/vitest`'s global `Assertion` augmentation to apply to `__tests__/app.test.tsx`) require it — both were missed on the first pass and surfaced as real `npm run test`/`npm run build` failures, not just theoretical gaps.
- **Path aliases**: `@/*` → `./src/*` is resolved by the `vite-tsconfig-paths` plugin in `vite.config.ts`, for both dev and build. This is a deliberate difference from `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` — that option is **not real** (Vite silently ignores it; confirmed while fixing `buyer-app`'s Vitest config in Issue #5), so it's never used here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via the `@tailwindcss/vite` plugin in `vite.config.ts` and a single `@import "tailwindcss";` in `src/index.css` — the Vite-native equivalent of `buyer-app`'s PostCSS-based `@tailwindcss/postcss` wiring.
- **Styling utilities**: `clsx` + `tailwind-merge` are combined into one `cn()` helper (`src/lib/utils.ts`, `twMerge(clsx(inputs))`), the required way to build any conditional or externally-mergeable className anywhere in the app — it gives passthrough `className` props correct last-wins Tailwind conflict resolution, unlike a plain string join. `class-variance-authority` (`cva()`) is layered on top only for components with a real variant prop map (`Button`, `Card`, `StatusBadge`, `FormField`'s `ReadOnlyField`, `PageHeader`) — see AGENTS.md's "Shared UI component library styling" section for the full convention and rationale.
- **ESLint**: `eslint.config.mjs` uses `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` (the standard Vite React-TS template set) — resolved when `eslint` runs from within `admin-app/` (e.g. `npm run lint --workspace admin-app`). The root `eslint.config.ts` still covers `admin-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — same non-conflicting layering as `buyer-app`.
- **Deployment**: `vercel.json` rewrites every path to `/index.html` — required for a client-side-routed SPA (`react-router`'s `BrowserRouter`) hosted on Vercel, otherwise a hard refresh on e.g. `/products/123` 404s at the host level before React ever loads.

## Testing

- Vitest (`environment: "jsdom"`) + React Testing Library + MSW, per root `docs/architecture.md` §8 — same shape as `buyer-app` (see `buyer-app/docs/architecture.md`). `vitest.config.ts` reuses the `@vitejs/plugin-react` and `vite-tsconfig-paths` devDependencies already installed for `vite.config.ts`, rather than adding a second copy.
- Test files live in workspace-root `__tests__/`, not colocated in `src/` — `__tests__/app.test.tsx` renders `App` directly (`src/App.tsx`), since routing is composed in-app via `react-router`'s `BrowserRouter` + `src/routes/mainRoutes.tsx`, unlike `buyer-app` where Next owns routing externally to the page component.
- `__tests__/mocks/server.ts` + `handlers.ts` hold one shared MSW server, started/stopped once in `vitest.setup.ts`; later feature tests extend `handlers.ts` or call `server.use(...)` per-test rather than re-wiring MSW from scratch.
- `__tests__/features/` mirrors `src/features/`'s own layout, including the `product-catalog/` nesting — a test file's directory depth always matches its source counterpart, so relative imports to shared `__tests__` helpers (`../../../mocks/server`, `../../../utils/renderWithStore`) stay in sync with wherever the source feature actually sits.
- No coverage threshold yet, matching `backend`/`buyer-app`'s "reporting only" stance.

## Dev workflow

- `npm run dev --workspace admin-app` — `vite`, serves on `http://localhost:5173`
- `npm run build --workspace admin-app` — `tsc -b && vite build`, must succeed
- `npm run lint --workspace admin-app` — `eslint .` (uses this workspace's own flat config)
- `npm run preview --workspace admin-app` — `vite preview`, serves the production build locally
- `npm run test --workspace admin-app` — `vitest run`
- Copy `.env.example` to `.env` before running locally (`VITE_API_URL`) — `src/config/env.ts` falls back to `http://localhost:4000` if unset, so this step is optional for local dev against the default backend port, unlike `backend`'s `env.ts`, which throws on a missing required var.
