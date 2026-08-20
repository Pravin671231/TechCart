# buyer-app — architecture

Implementation-level detail for `buyer-app/`. This is the concrete companion to root [`docs/architecture.md`](../../docs/architecture.md) §4.1 — it doesn't restate or override root-level decisions, just shows how they're actually built here.

## Structure

`src/app/` is routing only (Next's file-system router requires this). Actual UI/logic lives in `src/features/<feature>/`. `src/store/` (Issue #71 / M2.14) is a third, cross-cutting top-level `src/` directory — not a "feature" itself, but the Redux Toolkit + RTK Query plumbing every feature's data-fetching sits on top of:

```
src/
├── app/
│   ├── layout.tsx           # root layout, page metadata, self-hosted fonts (next/font/google), mounts StoreProvider
│   ├── loading.tsx           # root Suspense fallback — placeholder brand spinner shown during route navigation (Issue #119)
│   ├── page.tsx               # thin route file — imports and renders HomeContent
│   └── globals.css             # @import "tailwindcss"; brand-token @theme + @theme inline (fonts)
├── features/
│   ├── home/
│   │   └── HomeContent.tsx      # home screen: composes products/ toolbar+grid+pagination, holds page/sort state
│   ├── category/
│   │   ├── CategoryContent.tsx    # category screen: breadcrumb+filter rail+row list+pagination, page/sort/filters state
│   │   ├── CategoryProductCard.tsx # category-specific row card (3-column, cardSpecifications list) — NOT shared with home/search
│   │   ├── CategoryProductList.tsx  # row-list layout (flex column), parallel to products/ProductGrid but not the same shape
│   │   ├── CategoryListSkeleton.tsx  # row-shaped loading state — products/ProductListSkeleton is grid-shaped, wrong for this page
│   │   ├── CategoryFilterRail.tsx     # price/brand/in-stock/on-sale controls
│   │   ├── CategoryBreadcrumb.tsx      # + resolveBreadcrumb(), resolves parent name via categories/ list
│   │   └── CategoryNotFound.tsx         # distinct from products/ProductListError — a 404 isn't retriable
│   ├── search/
│   │   ├── SearchContent.tsx        # search screen: active-keyword heading+filter rail+grid+pagination, page/sort/filters state
│   │   ├── SearchFilterRail.tsx      # category (single-select, two-level)+price+brand+in-stock/on-sale controls
│   │   ├── SearchSortSelect.tsx       # relevance (default)+price/newest — relevance only makes sense with a keyword
│   │   └── SearchEmpty.tsx             # two distinct empty states (FR-CAT-067): keyword-empty vs. filter-empty copy
│   ├── productDetail/
│   │   ├── ProductDetailContent.tsx  # detail screen: breadcrumb+gallery+buy box+description+specs, selectedAttributes state
│   │   ├── ProductGallery.tsx         # primary image + thumbnails, resets selection on a variant-driven images swap
│   │   ├── VariantSelector.tsx         # groups variants[] by attribute axis; pickVariant() resolves the active variant
│   │   ├── ProductSpecifications.tsx    # grouped spec table, rendered verbatim (FR-CAT-063)
│   │   ├── AvailabilityBadge.tsx         # in_stock/low_stock/out_of_stock pill
│   │   ├── ProductNotFound.tsx            # PRODUCT_NOT_FOUND/INVALID_SLUG state — distinct from the generic error state
│   │   └── ProductDetailSkeleton.tsx       # loading state
│   ├── products/
│   │   ├── types.ts                # PublicProductListItem, PublicProductDetail, etc. — matches backend exactly
│   │   ├── api.ts                   # productsApi.injectEndpoints — getProducts, getCategoryProducts, searchProducts, getProductBySlug
│   │   ├── money.ts                  # formatPrice() — Intl.NumberFormat("en-IN", {style:"currency",currency:"INR"})
│   │   ├── ProductCard.tsx            # home/search's grid-tile card: image+name+price only (FR-CAT-091)
│   │   ├── ProductGrid.tsx             # grid layout — used by home and search (category uses its own row list)
│   │   ├── ProductListSkeleton.tsx      # grid-shaped loading state
│   │   ├── ProductListEmpty.tsx          # shared empty state — reused as-is by category (search has its own, two-state version)
│   │   ├── ProductListError.tsx           # shared error state + retry — reused as-is by category and search
│   │   ├── Pagination.tsx                  # shared pagination controls + describeRange() — reused as-is
│   │   └── SortSelect.tsx                   # shared sort control (no relevance option) — reused as-is by home
│   ├── categories/
│   │   ├── types.ts                # PublicCategory
│   │   └── api.ts                   # getCategories — full public active-category list
│   └── brands/
│       ├── types.ts                # PublicBrand
│       └── api.ts                   # getBrands — full public brand list, backs the category/search filter rails
├── store/
│   ├── env.ts                    # validates NEXT_PUBLIC_API_URL at import time, throws if missing
│   ├── api.ts                    # RTK Query api slice — envelope unwrap/error normalization, tagTypes, no endpoints
│   ├── store.ts                  # configureStore factory (makeStore) + AppStore/RootState/AppDispatch types
│   ├── StoreProvider.tsx          # "use client" boundary wrapping <Provider>, mounted in layout.tsx
│   └── hooks.ts                    # typed useAppDispatch/useAppSelector/useAppStore
└── components/
    └── layout/                    # Issue #122 — cross-route chrome, not feature-owned
        ├── Header.tsx              # logo + static /search link, translated from mock-ui/buyer-app/
        ├── Footer.tsx              # brand/links/social/payment columns, translated from mock-ui/buyer-app/
        └── AppShell.tsx            # composes Header + {children} + Footer, mounted in layout.tsx
```

See `AGENTS.md` for the full app/ vs features/ vs store/ convention.

## State management / data fetching

- **Redux Toolkit + RTK Query**, not TanStack Query — a deliberate choice (Issue #71 / M2.14), since `createApi`'s cache tags give the later filtered/paginated listing screens (M2.16/M2.17) automatic refetch-on-arg-change with no manual `useEffect` wiring. Root `docs/architecture.md` §4.1 is updated to match.
- `src/store/api.ts` defines **zero endpoints** — `endpoints: () => ({})`, RTK Query's own documented empty-API-slice pattern. Later feature issues add endpoints via `api.injectEndpoints({...})` inside their own `src/features/<feature>/api.ts`, never by editing `src/store/api.ts` directly. `tagTypes: ["Product", "Category"]` is declared here so those endpoints can `providesTags`/`invalidatesTags` against a shared, pre-agreed list.
- A single custom `baseQuery` (`src/store/api.ts`, wrapping `fetchBaseQuery`) does two things for every endpoint automatically: unwraps `backend`'s `{success:true,data}` envelope down to `data`, and normalizes both of `backend`'s distinct error shapes (`{success:false,code,message}` and, for `ZodError`s specifically, `{success:false,code,errors}` with no `message` key) into one consistent `{code,message}` shape — synthesizing `message` from `errors` when the latter is what the backend sent. Every `useXQuery()` hook's `error` is therefore always `NormalizedApiError`, never the raw backend shape.
- List responses' `pagination` key is threaded through via RTK Query's `meta` (Issue #72 / M2.15, resolving the `TODO` left by #71): `baseQueryWithEnvelope` returns `{ data: body.data, meta: { pagination: body.pagination } }` on success, typed via the `BaseQueryFn`'s 5th (`Meta`) type parameter; a list endpoint's own `transformResponse(response, meta)` combines the two into `{ items, pagination }`. `src/features/products/api.ts`'s `getProducts` is the first, and only, consumer so far.
- The Redux store is created **per-`StoreProvider`-instance** (`useState(() => makeStore())`, not a module-level singleton), per Redux Toolkit's own Next.js App Router guidance — avoids cross-request state bleed if a route later becomes dynamically SSR'd. `layout.tsx` stays a Server Component (still exports `metadata`); `StoreProvider.tsx` is the `"use client"` boundary that mounts `<Provider>` around `children`.
- `NEXT_PUBLIC_API_URL` fails loudly, not silently: `src/store/env.ts` validates it with `zod` at module-evaluation time and throws immediately if unset. Because `StoreProvider` is reachable from every route including the statically-prerendered `/`, `next build`'s static-generation pass pulls in `env.ts` and the build fails outright with a clear message if the var is missing; under `next dev` the same throw surfaces via the dev error overlay on first request. Never add a hardcoded fallback default in code — the `http://localhost:4000` local-dev default is documentation-only, living in `.env.example`'s comment.
- `src/features/products/` (Issue #72 / M2.15) is the first `injectEndpoints`-owning feature, resource-named (not screen-named) so any screen needing product data can reuse it. What later screens actually reused turned out narrower than originally anticipated: Issue #73 / M2.16 (category listing) confirmed by reading `mock-ui/buyer-app/search.html` directly that its cards use home's own `aspect-square` grid shape, **not** category's row layout — so `ProductCard`/`ProductGrid` are home-specific after all, while `Pagination`, `SortSelect`, `ProductListEmpty`, and `ProductListError` (no grid-specific coupling in either) were genuinely reusable as-is. Category's row-shaped equivalents (`CategoryProductCard`, `CategoryProductList`, `CategoryListSkeleton`) live in `src/features/category/` instead. `src/features/products/api.ts` itself remained the right home for `getCategoryProducts` (added by #73) despite the UI split — it's the same `PublicProductListItem` resource, just a different query.
- `src/features/categories/` and `src/features/brands/` (both new in Issue #73 / M2.16) are resource-named features holding one `GET`-only endpoint each (`getCategories`, `getBrands` — full, unpaginated public lists), consumed by `category/`'s breadcrumb and filter rail respectively.
- `src/app/category/[slug]/page.tsx` (Issue #73 / M2.16) is the first dynamic route in the entire monorepo (`admin-app` is a Vite/react-router SPA, not Next — no prior App Router precedent existed). This Next version passes `params` as a `Promise<{slug}>`; the route file stays a thin `async` Server Component (`const {slug} = await params`) per the "app/ is routing only" convention, passing `slug` down to `CategoryContent` as a plain prop.
- `src/features/search/` (Issue #74 / M2.17, `FR-CAT-065`/`067`/`075`) is the third screen-composition feature — confirmed by reading `mock-ui/buyer-app/search.html` directly that its cards use home's `aspect-square` grid shape (not category's row layout), so it reuses `products/`'s `ProductGrid`/`ProductCard`/`Pagination`/`ProductListSkeleton`/`ProductListError` as-is, the same reuse category already established. Two pieces are search-specific rather than shared: `SearchSortSelect` (a `relevance` option — the default — that's only meaningful alongside a keyword, so it isn't merged into `products/SortSelect`, which home also uses with no keyword ever present) and `SearchEmpty` (`FR-CAT-067`'s two distinct empty states — copy differs depending on whether the empty result traces to the keyword itself or to a filter narrowing it further, decided client-side by checking whether any filter is currently set). `productsApi.searchProducts` (`src/features/products/api.ts`) hits the same `GET /api/products` endpoint `getProducts` does, adding `q` plus the full `FR-CAT-068`–`076` filter surface (`category`, `brand`, price range, in-stock, on-sale) — no new backend endpoint was needed since `#36` already built this into the flat listing route.
- `src/app/search/page.tsx` (Issue #74 / M2.17) is the second dynamic-ish route (technically static path, dynamic query) — `searchParams` is a `Promise<{q?: string}>` in this Next version, `await`ed the same way `category/[slug]/page.tsx` awaits `params`; the route stays a thin async Server Component per the "app/ is routing only" convention.
- `src/features/productDetail/` + `src/app/products/[slug]/page.tsx` (Issue #75 / M2.18, `FR-CAT-056`/`059`/`063`/`064`/`084`) is the third dynamic route, using the same `Promise<{slug}>` pattern as category's. `productsApi.getProductBySlug` (`src/features/products/api.ts`) hits `GET /api/products/:slug`; a `PRODUCT_NOT_FOUND` or `INVALID_SLUG` `error.code` renders `ProductNotFound`, any other error renders a generic retry state (mirroring `ProductListError`'s copy/shape inline, since a not-found page has no list to paginate/retry against in the same way). Per `FR-CAT-064`, selecting a variant never refetches: `VariantSelector` tracks `selectedAttributes` (one value per attribute axis, e.g. `{Storage: "256GB"}`) as component state, and `ProductDetailContent`'s `pickVariant()` resolves the matching entry in the already-cached response's `variants[]` array on every selection change — an exact-match-across-every-selected-axis variant when one exists, else the first variant sharing the most recently changed axis value, so the buy box always has something to display. The initial selection seeds from `defaultVariantId` (present only when at least one active variant exists, per `#35`'s `selectDefaultVariant()`), falling back to the first variant when the response has variants but no default id — a state that can't actually occur given backend's own invariants, kept only as a defensive fallback so `pickVariant()` never receives an empty selection with variants present. A variant with no images of its own already falls back to the parent's images server-side (`#35`'s `toPublicVariant()`); `ProductGallery` doesn't repeat that fallback client-side.
- **Known limitation**: variant-attribute and filterable-spec-field filter _controls_ (e.g. "Colour", "RAM") shown in `mock-ui/buyer-app/category.html` are **not implemented**. `cardSpecifications` still renders correctly on each category row card (that data legitimately arrives per-product on every list response) — only the filter _controls_ for these two facets are cut. Verified directly: `categorySpecifications`/`categoryVariants` backend modules are genuinely admin-only (mounted only under the `X-Admin-Key`-gated `adminRouter`), so no buyer endpoint exposes a category's filterable field types, option lists, numeric bounds, or variant-axis/color-hex data. A real fix needs a new buyer-facing backend endpoint (e.g. `GET /api/categories/:slug/filters`) — tracked as a deliberate follow-up, not a silent gap.
- **Product card navigation** (Issue #120): `ProductCard.tsx` and `CategoryProductCard.tsx` never had any navigation wired up — both rendered a plain `<article>` with no `<Link>`/`onClick`, matching `mock-ui/`'s own static (non-interactive) wireframes exactly, confirmed via `git log --follow` to be a genuine gap since each component's one and only commit, not a regression. Both now wrap their existing markup in a `next/link` `<Link href={`/products/${product.slug}`}>` — the whole card is the clickable region — reusing the same `next/link` pattern already established by `CategoryBreadcrumb`/`ProductNotFound`/`CategoryNotFound`. `PublicProductListItem.slug` already carried the needed data; no type or fetching changes.
- **Fonts and loading state** (Issue #119): `src/app/globals.css` previously pulled Inter/Plus Jakarta Sans via a render-blocking `@import url("https://fonts.googleapis.com/...")` — a synchronous cross-origin fetch blocking first paint, identified as the main fixable contributor to a reported ~10s initial load. `layout.tsx` now loads both via `next/font/google` (self-hosted, `display: "swap"`, `variable: "--font-inter"`/`"--font-jakarta"` applied to `<html>`); `globals.css` gained a second `@theme inline { ... }` block (separate from the color-token `@theme` block) mapping `--font-sans`/`--font-display` to `var(--font-inter)`/`var(--font-jakarta)` — `@theme inline`, not plain `@theme`, is required because the value references a runtime CSS variable rather than a static literal. Every existing `font-sans`/`font-display` Tailwind utility class keeps working unchanged. A new root `src/app/loading.tsx` (a plain Server Component, no `"use client"`) is the first `loading.js`-convention special file in the app — it auto-wraps every route below it (none of the four routes have their own nested `layout.tsx`) in a `<Suspense>` boundary, rendering a brand-token CSS spinner. It's an explicit placeholder for a future real branded GIF asset, not a finished design. **Deliberately out of scope**: converting the app's 100%-client-side RTK Query data-fetching pattern (every screen-composition feature is `"use client"` and fetches on mount) to server-side/RSC data fetching — the highest-impact fix for the reported load time, but a major re-architecture of the pattern set by Issues #71–75; left for a future issue.
- **Header/Footer layout shell** (Issue #122): `src/components/layout/` is a new top-level directory, peer to `app/`/`features/`/`store/` — the first place for cross-route chrome rather than feature-owned code. `Header.tsx`/`Footer.tsx` are translated directly from `mock-ui/buyer-app/`'s own header/footer, confirmed byte-identical across all 4 page mocks (`home.html`/`category.html`/`search.html`/`product-detail.html`) via a direct diff, so there's exactly one shell to build, not per-route variants; `AppShell.tsx` composes `<Header/>{children}<Footer/>` and is mounted once in `src/app/layout.tsx`. All three stay Server Components (no `"use client"`) — static markup plus `next/link`, rendered from the already-Server-Component `layout.tsx`, so `StoreProvider` remains the app's one deliberate client boundary. The header's "Search products…" box is a static link to `/search`, not a functional input (confirmed via grep: no search-input feature exists anywhere in buyer-app yet — a separate, focused issue); the mock's Cart icon (hardcoded badge) and "All Categories ▾" dropdown are omitted outright, since neither has a real feature or route behind it (no cart in v0.2; no all-categories listing route, only `/category/[slug]`). Every other mock link with no real destination (footer's Customer Service links, social icons, Privacy Policy/Terms & Conditions) renders as a plain `<a href="#">`, not `next/link` — `next/link` is for real internal routes with prefetching, and these are wireframe placeholders the mock itself already treats as non-functional, not new behavior being invented. No new test file — matches the established precedent that layout-tier chrome (`layout.tsx` itself, `CategoryBreadcrumb`) has no dedicated unit tests; the existing screen tests render feature content directly via `<Provider>`, never through the real `layout.tsx`, so they're unaffected.

## Current file tree

```
buyer-app/
├── package.json          # name "buyer-app"; scripts: dev, build, start, lint, test
├── tsconfig.json           # Next-generated — NOT extending ../tsconfig.base.json (see Config below)
├── next.config.ts
├── postcss.config.mjs        # @tailwindcss/postcss plugin
├── eslint.config.mjs           # eslint-config-next (core-web-vitals + typescript) — separate from root eslint.config.ts
├── vitest.config.ts             # jsdom environment, @vitejs/plugin-react, vite-tsconfig-paths
├── vitest.setup.ts                # jest-dom matchers, MSW server lifecycle, RTL cleanup
├── AGENTS.md                    # Next.js version-guard warning (auto-generated) + TechCart addendum
├── CLAUDE.md                     # @AGENTS.md (Claude Code import syntax)
├── docs/architecture.md            # this file
├── .env.example                   # NEXT_PUBLIC_API_URL (blank; default documented in a comment)
├── __tests__/
│   ├── home.test.tsx               # renders HomeContent via a real store: happy/empty/error/sort-refetch
│   ├── category.test.tsx             # renders CategoryContent: breadcrumb, cardSpecifications, filter-refetch, not-found
│   ├── search.test.tsx                # renders SearchContent: active keyword, both FR-CAT-067 empty states, ?q=/sort params
│   ├── productDetail.test.tsx           # renders ProductDetailContent: default-variant preselect, variant-switch (no refetch), not-found
│   ├── store/api.test.ts             # api slice: envelope unwrap, error normalization, fail-loud env check
│   └── mocks/{handlers.ts,server.ts}  # shared MSW server, extended by later feature tests
└── src/
    ├── app/{layout.tsx,loading.tsx,page.tsx,globals.css,category/[slug]/page.tsx,search/page.tsx,products/[slug]/page.tsx}
    ├── features/home/HomeContent.tsx
    ├── features/category/{CategoryContent,CategoryProductCard,CategoryProductList,CategoryListSkeleton,CategoryFilterRail,CategoryBreadcrumb,CategoryNotFound}.tsx
    ├── features/search/{SearchContent,SearchFilterRail,SearchSortSelect,SearchEmpty}.tsx
    ├── features/productDetail/{ProductDetailContent,ProductGallery,VariantSelector,ProductSpecifications,AvailabilityBadge,ProductNotFound,ProductDetailSkeleton}.tsx
    ├── features/products/{types,api,money,ProductCard,ProductGrid,ProductListSkeleton,ProductListEmpty,ProductListError,Pagination,SortSelect}.ts(x)
    ├── features/categories/{types,api}.ts
    ├── features/brands/{types,api}.ts
    └── store/{env.ts,api.ts,store.ts,StoreProvider.tsx,hooks.ts}
```

## Config

- **TypeScript**: `tsconfig.json` is Next's own generated config (`module: "esnext"`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, the `next` TS plugin, `@/*` → `./src/*`). It deliberately does **not** `extends: "../tsconfig.base.json"` — that file's Node-oriented settings (`module`/`moduleResolution: NodeNext`, no DOM lib) are incompatible with what Next requires. Sharing strictness flags across all three workspaces is a possible future follow-up, not done here.
- **Tailwind CSS 4**: CSS-first config — no `tailwind.config.js`. Wired via `postcss.config.mjs` (`@tailwindcss/postcss` plugin) and a single `@import "tailwindcss";` in `src/app/globals.css`.
- **ESLint**: `eslint.config.mjs` uses `eslint-config-next` (React hooks rules, Next-specific rules, core-web-vitals) — resolved when `eslint` runs from within `buyer-app/` (e.g. `npm run lint --workspace buyer-app`). The root `eslint.config.ts` still covers `buyer-app/**` with baseline TS rules when run repo-wide (`npx eslint .` from root) — the two aren't in conflict, just different scopes.

## Testing

- Vitest (`environment: "jsdom"`) + React Testing Library + MSW, per root `docs/architecture.md` §8. `vitest.config.ts` uses the `vite-tsconfig-paths` plugin for `@/*` resolution plus `@vitejs/plugin-react` for JSX transform — neither is needed by `backend`'s Node-only config. Note: `backend/vitest.config.ts`'s `resolve: { tsconfigPaths: true }` is **not** a real Vite/Vitest option (verified by reproducing its `@/app` resolution failure); `backend/CLAUDE.md`'s claim that this works natively is inaccurate and worth a follow-up fix there.
- Test files live in workspace-root `__tests__/`, not colocated in `src/` — `__tests__/store/api.test.ts` (Issue #71 / M2.14) exercises the RTK Query `baseQuery` end-to-end via a throwaway `api.injectEndpoints({...})` test endpoint dispatched through a real `makeStore()`. `__tests__/home.test.tsx` (rewritten for Issue #72 / M2.15) is the first test rendering a real feature component (`HomeContent`, manually wrapped in `<Provider store={makeStore()}>`) against MSW-mocked `GET /api/products` responses — covers happy path, empty state, error state, and a sort-change triggering a real refetch with the new `?sort=` value, using `@testing-library/user-event` for the interaction. `__tests__/category.test.tsx` (Issue #73 / M2.16) follows the identical pattern against `CategoryContent`, mocking `GET /api/categories/:slug/products`, `GET /api/categories`, and `GET /api/brands` together — covers breadcrumb resolution, `cardSpecifications` rendering exactly what a product has (no placeholder padding), a brand-filter change refetching with the corresponding param and resetting to page 1, sort-change refetch, and the `CATEGORY_NOT_FOUND` not-found state. `__tests__/search.test.tsx` (Issue #74 / M2.17) follows the same pattern against `SearchContent`, mocking `GET /api/products` (this screen has no dedicated backend route — `searchProducts` hits the same flat listing endpoint `getProducts` does, with `q` added) — covers the active keyword rendering prominently, `?q=`/default-`relevance`-`?sort=` reaching the request, and both `FR-CAT-067` empty states rendering distinct copy (keyword-empty vs. an "In stock" filter toggle producing the filter-empty copy instead). `__tests__/productDetail.test.tsx` (Issue #75 / M2.18) mocks `GET /api/products/:slug` with a request-counting handler specifically to assert `FR-CAT-064`'s "no additional network request" behavior — a variant-switch click is followed by an assertion that the mocked handler's call count is still `1` — alongside the default-variant preselection and the `PRODUCT_NOT_FOUND` not-found state.
- `__tests__/mocks/server.ts` + `handlers.ts` hold one shared MSW server, started/stopped once in `vitest.setup.ts`; later feature tests extend `handlers.ts` or call `server.use(...)` per-test rather than re-wiring MSW from scratch.
- Because `src/store/env.ts` throws at import time, `api.test.ts` uses `vi.stubEnv` + `vi.resetModules()` + dynamic `import()` per test to get an isolated module graph with a controlled env value each time — the same technique any future test needing a different `NEXT_PUBLIC_API_URL` state should reuse.
- Components using RTK Query hooks (`useXQuery`, etc.) need a manual `<Provider store={makeStore()}>` wrapper in any test that renders them directly with RTL — `vitest.setup.ts`/`layout.tsx`'s `StoreProvider` isn't in the tree for a component rendered in isolation.
- No coverage threshold yet (matches `backend`'s "reporting only" stance — a gate lands once there are real features to measure).

## Dev workflow

- Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_API_URL` (local dev default `http://localhost:4000`, matching `backend`'s default `PORT`) before running `dev` or `build` — both fail immediately with a clear error if it's missing (`src/store/env.ts`).
- `npm run dev --workspace buyer-app` — `next dev`, serves on `http://localhost:3000`
- `npm run build --workspace buyer-app` — `next build`, must succeed
- `npm run lint --workspace buyer-app` — `eslint` (uses this workspace's own `eslint-config-next` rules)
- `npm run test --workspace buyer-app` — `vitest run`
