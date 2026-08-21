# Issue Drafts

**Project:** TechCart
**Status:** M0 (Foundation), M1 (CI Pipeline), and M2 (Product Catalog) are all opened as real GitHub Issues — #1–#10, and #25–#36/#41/#71–#82/#102/#104 under [Milestone #3](https://github.com/Pravin671231/TechCart/milestone/3) respectively; M2 is Complete and tagged `v0.2.0`. M3–M11 (Authentication through Launch Readiness) are also now all opened as real GitHub Issues — #139–#197 across [Milestones #4–#12](https://github.com/Pravin671231/TechCart/milestones?state=open) — so every milestone's draft text has been removed from this file; see `docs/milestone.md` and `docs/srs/SRS.md` §6 for their roadmap-level and traceability records. The **Backlog** below holds the M2 addendum plus the cross-cutting `mock-ui` end-to-end wireframes issue (opened as [Issue #200](https://github.com/Pravin671231/TechCart/issues/200), no milestone) — both kept for reference following `M2.13`'s own precedent, since every other milestone drafted here so far has had its section removed once opened.

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5. Once a milestone's issues are opened on GitHub, its draft section is removed from here — most recently for M3–M11 as of Issues #139–#197.

**Scope of this file right now:** the M2 addendum and the `mock-ui` end-to-end issue below, both kept for reference rather than removed. Every SRS feature version through v0.10 (Inventory Management) has its issues opened on GitHub; the next new Backlog section here will be v1.1 (Final Consolidated SRS / Launch Readiness's `FR`-numbered work, if any), once that version is itself spec-drafted per `SRS.md` §7's rule that v1.1 can't be honestly written until M3–M10 are actually implemented.

**Numbering:** within a drafted-but-unopened milestone, `M<x>.1`, `M<x>.2`, etc. are draft sequence numbers, not GitHub issue numbers. When an issue is actually opened (`gh issue create`), use the real assigned number for its branch: `feature/<real-issue-number>-<scope>`.

---

## Template

`.github/ISSUE_TEMPLATE/feature-issue.md` mirrors the shape below for `gh issue create`/the GitHub web UI — keep the two in sync if this shape changes.

Every milestone in the Backlog is a `###` section; every issue inside it follows this shape, one heading level deeper:

```
#### <Milestone>.<N> — <Title>
**Milestone:** M<x> – <Milestone name>
**Suggested branch:** feature/<issue-number>-<scope>
**Labels:** <labels>

**Context**
<Why this issue exists, what it depends on, what it unblocks.>

**Tasks**
- [ ] <ordered implementation step>

**Test Criteria**
- <verifiable, unambiguous condition>
```

---

## Backlog

Milestones in this section are fully drafted — issues with real Context/Tasks/Test Criteria — but not yet opened as real GitHub Issues or a GitHub Milestone. A milestone moves out of this section once its issues are actually opened via `gh issue create` (most recently M2, now Issues #25–#36).

### M2 — Product Catalog (addendum)

#### M2.13 — Mock UI verification & traceability for Product Catalog

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/41-mock-ui-verification
**Labels:** documentation, catalog

**Context**
`mock-ui/` already contains a structural wireframe for every screen SRS v0.2 §6 calls for — 4 `buyer-app` screens and 7 `admin-app` screens, each annotated with its `FR-CAT-*` IDs, cross-linked into a click-through prototype. It was added via direct commits (`0b0f0e8`, `d2d95b3`) outside the normal Issue → Implement flow this repo otherwise enforces, and SRS v0.2 §10 still lists "screen-level UI design" as an open question even though `mock-ui/README.md` already answers it in practice. This issue brings that already-done design work under M2 tracking and closes the loop: verify it, document the SRS-to-mock-ui traceability, and formally resolve the open question — not add new wireframes.

**Tasks**

- [ ] Cross-check every §6 screen/state against its `mock-ui/*.html` file; note any gap
- [ ] Fix any discrepancy found
- [ ] Add a scan-able §6-requirement → `FR-CAT-*` → mock-ui file table to `mock-ui/README.md`
- [ ] Move "screen-level UI design" from Open Question 1 to "Resolved during drafting" in `docs/srs/features/0.2-product-catalog.md` §10, referencing `mock-ui/`
- [ ] Add a one-line pointer to `mock-ui/` from `buyer-app/CLAUDE.md` and `admin-app/CLAUDE.md`

**Test Criteria**

- Every §6 screen/state has a correctly annotated `mock-ui/*.html` counterpart
- SRS v0.2 §10 no longer lists screen-level design as unresolved
- `buyer-app/CLAUDE.md` and `admin-app/CLAUDE.md` each reference `mock-ui/`
- No `mock-ui/*.html` file is orphaned from `mock-ui/index.html`; no internal link 404s

#### M2.14 — buyer-app: Redux Toolkit store & RTK Query API setup

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/71-buyer-redux-setup
**Labels:** frontend, buyer-app, catalog

**Context**
`buyer-app` has no state-management or HTTP layer yet. Every screen issue below (`M2.15`–`M2.18`) needs one consistent way to call `backend` and handle its `{success,data[,pagination]}` / `{success:false,code,message}` contract. Per root `CLAUDE.md`'s "no shared validation package" simplification, `buyer-app` owns this itself rather than importing anything from `backend`. Chosen approach: **Redux Toolkit + RTK Query** (`@reduxjs/toolkit`, `react-redux`) — `createApi`'s cache tags give the filtered/paginated listing screens (`M2.16`/`M2.17`) automatic refetch-on-arg-change with no manual `useEffect` wiring. `backend`'s CORS allowlist already defaults to `http://localhost:3000` for local dev, so no backend change is needed to unblock this.

**Tasks**

- [ ] Add `@reduxjs/toolkit` + `react-redux` to `buyer-app`
- [ ] Add `NEXT_PUBLIC_API_URL` to a new `buyer-app/.env.example` (documented, no real value committed; defaults to `http://localhost:4000` in dev)
- [ ] `src/store/api.ts`: `createApi` with `fetchBaseQuery({ baseUrl: NEXT_PUBLIC_API_URL })`; a `transformResponse` unwrapping `{success:true,data}` to `data`, and a `transformErrorResponse`/custom `baseQuery` surfacing `{success:false,code,message}` as the query's `error` in a consistent shape
- [ ] `src/store/store.ts`: `configureStore` wiring the api slice's reducer + middleware; a `Provider` mounted in `src/app/layout.tsx` (or a client-component wrapper, per Next App Router's server/client split)
- [ ] Define `tagTypes` (`Product`, `Category`) on the api slice for later issues' cache invalidation
- [ ] Unit test the `transformResponse`/error-transform logic

**Test Criteria**

- A mocked `{success:true,data}` response resolves as the query's `data`; a mocked `{success:false,code,message}` response surfaces as the query's `error` with `code`/`message` intact
- A missing `NEXT_PUBLIC_API_URL` fails loudly at startup, not silently
- `npm run build|test|lint --workspace buyer-app` all pass

#### M2.15 — buyer-app: Home / all-products listing

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/72-buyer-home
**Labels:** frontend, buyer-app, catalog

**Context**
Builds `mock-ui/buyer-app/home.html` (`FR-CAT-054`, `057`–`059`, `075`, `091`) into `src/features/home/`, replacing `HomePlaceholder.tsx`, wired to `GET /api/products` via a new `useGetProductsQuery` endpoint on `M2.14`'s api slice. First real screen — also produces the shared `ProductCard`/`ProductGrid` components `M2.16`/`M2.17` reuse.

**Tasks**

- [ ] Replace `HomePlaceholder` with a real feature reading `mock-ui/buyer-app/home.html`'s structure/utility classes
- [ ] Add a `getProducts` query endpoint (`providesTags: ["Product"]`) to the api slice; call it via `useGetProductsQuery({page, sort})`
- [ ] Sort control (`FR-CAT-075`) and pagination controls, driven by the hook's query args — RTK Query refetches automatically on arg change, no manual `useEffect`
- [ ] Skeleton (`isLoading`), empty (`data.length === 0`), and error (`isError`) states per the mock, using the hook's own status flags
- [ ] Extract a shared `ProductCard` (card content per `FR-CAT-091`: image, name, `sellingPrice`, etc.) and `ProductGrid` for reuse by `M2.16`/`M2.17`
- [ ] RTK Query's built-in mock-friendly testing (MSW handlers behind the real `fetch` `createApi` uses) + RTL tests: happy-path render, empty state, error state, sort-change refetch

**Test Criteria**

- `/` renders products from a mocked `GET /api/products` response, matching `mock-ui/buyer-app/home.html`'s structure
- Changing sort re-fetches with the new `?sort=` value with no manual refetch call (RTK Query arg-change behavior)
- Empty/error API responses render their mocked states, not a crash
- `npm run build|test|lint --workspace buyer-app` all pass

#### M2.16 — buyer-app: Category listing page

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/73-buyer-category
**Labels:** frontend, buyer-app, catalog

**Context**
Builds `mock-ui/buyer-app/category.html` (`FR-CAT-055`, `068`–`074`, `076`, `092`): breadcrumb, pre-filtered grid via `GET /api/categories/:slug/products`, the full filter rail (price/brand/variant-attribute/filterable-spec/in-stock/on-sale), and `cardSpecifications` (first four filterable fields, `FR-CAT-092`). Reuses `M2.15`'s `ProductGrid`/`ProductCard`; filter state changes are just new args to a `useGetCategoryProductsQuery` hook, which RTK Query refetches automatically.

**Tasks**

- [ ] New route + `src/features/category/` feature
- [ ] Add a `getCategoryProducts` query endpoint (`providesTags: ["Product"]`) to the api slice; call via `useGetCategoryProductsQuery({slug, filters, page, sort})`, reusing `ProductGrid`/`ProductCard`
- [ ] Breadcrumb from the resolved category data
- [ ] Filter rail: price range, brand, variant-attribute, filterable-spec (dynamic, driven by the category's own filterable spec list), in-stock, on-sale — each filter change updates the hook's query args
- [ ] Render `cardSpecifications` on each card when present — a product with fewer than 4 renders only the ones it has, no placeholder padding
- [ ] Handle `CATEGORY_NOT_FOUND` (404) with a not-found state via `isError`/`error.code`
- [ ] MSW handlers + RTL tests: filtered render, filter-change refetch with correct (bracket-notation) query params, not-found state

**Test Criteria**

- `/category/:slug` renders the category's products and breadcrumb from a mocked response
- Applying a filter re-fetches with the corresponding query param(s) correctly composed, via the RTK Query arg-change refetch
- A product with fewer than 4 filterable specs renders only what it has
- `npm run build|test|lint --workspace buyer-app` all pass

#### M2.17 — buyer-app: Search results page

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/74-buyer-search
**Labels:** frontend, buyer-app, catalog

**Context**
Builds `mock-ui/buyer-app/search.html` (`FR-CAT-065`, `067`, `075`): active keyword shown, relevance-default sort, and two distinct empty states (search-empty vs. filter-empty, `FR-CAT-067`). Wired to `GET /api/products?q=` via a `useSearchProductsQuery` endpoint, reusing `M2.15`'s grid/card.

**Tasks**

- [ ] New route + `src/features/search/` feature
- [ ] Add a `searchProducts` query endpoint (`providesTags: ["Product"]`); call via `useSearchProductsQuery({q, filters})`, default sort `relevance`
- [ ] Display the active keyword prominently, per the mock
- [ ] Implement the two distinct empty states (`FR-CAT-067`) with visibly different copy, driven off whether `q` or a filter is the differentiator
- [ ] MSW handlers + RTL tests covering both empty states and a populated render

**Test Criteria**

- The search route renders results and the active keyword from a mocked response
- Zero-results-from-keyword and zero-results-from-filters render distinct copy, matching `mock-ui/buyer-app/search.html`
- `npm run build|test|lint --workspace buyer-app` all pass

#### M2.18 — buyer-app: Product detail page

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/75-buyer-product-detail
**Labels:** frontend, buyer-app, catalog

**Context**
Builds `mock-ui/buyer-app/product-detail.html` (`FR-CAT-056`, `059`, `063`, `064`, `084`): gallery, variant selector, grouped specifications, availability badge. Wired via a `useGetProductBySlugQuery` endpoint; selecting a variant updates price/availability/images from local component state derived from the already-cached RTK Query response's `variants[]` array — no refetch (`FR-CAT-064`).

**Tasks**

- [ ] New dynamic route + `src/features/productDetail/` feature
- [ ] Add a `getProductBySlug` query endpoint (`providesTags: ["Product"]`); handle `PRODUCT_NOT_FOUND` (404) vs. `INVALID_SLUG` (400) distinctly via `error.code`
- [ ] Image gallery, falling back to the parent's images when a variant has none (`FR-CAT-064`)
- [ ] Variant selector updates displayed `mrp`/`discount`/`sellingPrice`/`availability`/images from local `useState` derived from the cached query data, no network call
- [ ] Grouped specifications rendered verbatim (`FR-CAT-063`); availability badge
- [ ] Default to `defaultVariantId` when present in the response
- [ ] MSW handlers + RTL tests: default render, variant-switch update, 404 state

**Test Criteria**

- The detail route pre-selects the default variant's price/availability/images when `defaultVariantId` is present
- Selecting a different variant updates the display with no additional network request (verified via the MSW handler call count)
- A `PRODUCT_NOT_FOUND` response renders a not-found state
- `npm run build|test|lint --workspace buyer-app` all pass

#### M2.19 — admin-app: Redux Toolkit store, RTK Query API setup & X-Admin-Key auth

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/76-admin-redux-setup
**Labels:** frontend, admin-app, catalog

**Context**
Mirrors `M2.14` for `admin-app` (same `@reduxjs/toolkit`/`react-redux`/`createApi` setup), plus every `/api/admin/*` call needs the `X-Admin-Key` header (`backend/src/middleware/adminAuth.ts`) — a temporary guard ahead of v0.3 Authentication (root `CLAUDE.md`). Since the key can't be committed or hardcoded, this issue adds a minimal, explicitly throwaway key-entry prompt (persisted to `sessionStorage` only, mirrored into a small `authSlice` so `prepareHeaders` can read it) rather than any real auth UI — real sessions replace this outright in M3.

**Tasks**

- [ ] Add `@reduxjs/toolkit` + `react-redux` to `admin-app`
- [ ] Add `VITE_API_URL` to a new `admin-app/.env.example` (defaults to `http://localhost:4000` in dev)
- [ ] `src/store/authSlice.ts`: holds `adminKey: string | null`, initialized by reading `sessionStorage` on load; a `setAdminKey`/`clearAdminKey` action pair that also syncs `sessionStorage`
- [ ] `src/store/api.ts`: `createApi` with `fetchBaseQuery({ baseUrl: VITE_API_URL, prepareHeaders: (headers, {getState}) => headers.set("X-Admin-Key", getState().auth.adminKey) })`; same envelope `transformResponse`/error-transform as `M2.14`; a `baseQuery` wrapper that dispatches `clearAdminKey` on a `401` response
- [ ] `src/store/store.ts` + `Provider` wiring in `src/app/App.tsx` (or its entry point)
- [ ] Minimal `src/features/adminKey/` prompt: block routes behind a single "enter admin key" field until `state.auth.adminKey` is set
- [ ] Unit tests for header attachment and 401-triggered re-prompt

**Test Criteria**

- No `admin-app` request reaches the backend without `X-Admin-Key` once a key has been entered
- A 401 response clears the stored key (Redux state + `sessionStorage`) and returns to the prompt
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.20 — admin-app: Brand management (list + form)

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/77-admin-brands
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/brand-list.html` (`FR-CAT-023`–`028`, `048`, `052`): list with logo/product-count, create/edit form, inline `BRAND_IN_USE` delete-guard rejection, search. Brands has no hierarchy or nested schema, making it the simplest catalog entity — a template for `M2.21`. First issue to add RTK Query *mutation* endpoints (create/update/delete/status), each invalidating the `Brand` list tag on success.

**Tasks**

- [ ] `src/features/brands/` — add `getBrands` query (`providesTags: ["Brand"]`, `?search=`) and `createBrand`/`updateBrand`/`deleteBrand`/`updateBrandStatus` mutations (each `invalidatesTags: ["Brand"]`) to the api slice
- [ ] List view via `useGetBrandsQuery`; create/edit form via `useCreateBrandMutation`/`useUpdateBrandMutation`, including logo upload via the presigned-upload flow (`POST /api/admin/uploads/presign` then a direct `PUT` to R2, `FR-CAT-077`–`081`)
- [ ] Status toggle via `useUpdateBrandStatusMutation`
- [ ] Delete via `useDeleteBrandMutation`, rendering the inline `BRAND_IN_USE` rejection (with blocking product count) on 409
- [ ] MSW handlers + RTL tests: list render, create/edit, delete-guard rejection, search

**Test Criteria**

- Create → edit → blocked-delete (referenced by a product) → status-toggle all work against mocked responses, with the list auto-refetching after each mutation via tag invalidation
- A guarded delete's 409 renders the blocking product count inline, not a generic error
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.21 — admin-app: Category management (list + form)

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/78-admin-categories
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/category-list.html` (`FR-CAT-014`–`022`, `048`, `051`): two-level hierarchy tree, combined product+subcategory delete guard. Reuses `M2.20`'s query/mutation-with-tag-invalidation pattern, adding the parent-category picker and the four hierarchy-validation error states (`INVALID_PARENT_CATEGORY`, `PARENT_CATEGORY_NOT_FOUND`, `PARENT_CATEGORY_TOO_DEEP`, `CATEGORY_HAS_SUBCATEGORIES`).

**Tasks**

- [ ] `getCategories`/`createCategory`/`updateCategory`/`deleteCategory`/`updateCategoryStatus` endpoints on the api slice (`Category` tag, same invalidation pattern as `M2.20`)
- [ ] Tree/list via `useGetCategoriesQuery` (+ `?search=`)
- [ ] Create/edit form with a parent-category picker (tri-state: none/root, or an existing category — one that already has children can't be assigned a parent)
- [ ] Wire all four hierarchy-validation error codes (from the mutation's `error`) to field-level errors, not generic toasts
- [ ] Delete rendering the combined "N product(s)/N subcategory(ies)" message
- [ ] MSW handlers + RTL tests covering the tree render, each hierarchy error, and the combined guard

**Test Criteria**

- All four hierarchy-validation error codes render distinct, correctly-worded inline errors
- A delete blocked by both products and subcategories shows both counts in one message
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.22 — admin-app: Category specification editor

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/79-admin-category-specs
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/specification-editor.html` (`FR-CAT-030`, `031`, `035`, `092`): nested groups/fields, type-dependent inputs (`options` required for `enum`, forbidden for `text`), inline `SPECIFICATION_FIELD_IN_USE` guard, reorder. Mounted against `GET`/`PUT`/`PATCH /api/admin/categories/:id/specifications` — no `POST`/`DELETE`, matching backend's deliberate shape.

**Tasks**

- [ ] `getCategorySpecifications` query + `replaceCategorySpecifications` (full `PUT`) and `patchCategorySpecifications` (the `PATCH` discriminated-union op) mutations, `CategorySpecification` tag
- [ ] Handles the synthetic empty `{category,specificationGroups:[]}` response before any `PUT` — RTK Query's normal "no data yet" state, not an error
- [ ] Full-replace `PUT` flow for adding/reordering groups and fields
- [ ] `PATCH`-based `renameGroup`/`deleteGroup`/`updateField`/`deleteField`, matching backend's discriminated-union shape exactly
- [ ] Type-dependent field inputs (options editor shown only for `enum`) — client-side mirror of backend's Zod refine, for UX only
- [ ] Inline in-use guard rendering, naming every blocking field
- [ ] MSW handlers + RTL tests: full-replace, each `PATCH` op, the in-use guard render

**Test Criteria**

- `GET` before any `PUT` renders the synthetic empty state, not an error
- Deleting a field/group in use names every blocking field/count from the guard response
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.23 — admin-app: Category variant-type editor

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/80-admin-category-variants
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/variant-type-editor.html` (`FR-CAT-036`–`038`): flat list of variant axes. Near-identical shape to `M2.22` but flat (no groups) and — the one deliberate divergence — **no in-use guard on delete at all**, since this definition drives admin form rendering only (`FR-CAT-037`). Should reuse `M2.22`'s query/mutation scaffolding where shapes overlap.

**Tasks**

- [ ] `getCategoryVariants` query + `replaceCategoryVariants`/`patchCategoryVariants` (`updateAxis`/`deleteAxis`) mutations, `CategoryVariant` tag
- [ ] Same synthetic-empty-`GET`/full-replace-`PUT`/`PATCH` pattern as `M2.22`, flat instead of grouped
- [ ] Type-dependent options editor (required for `select`/`color`, forbidden for `text`/`number`)
- [ ] No delete-guard UI for `deleteAxis` — deletion always succeeds immediately, matching backend
- [ ] MSW handlers + RTL tests

**Test Criteria**

- `GET` before any `PUT` renders the synthetic empty state
- `deleteAxis` succeeds with no in-use check, matching backend
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.24 — admin-app: Product list + read-only detail

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/81-admin-product-list
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/product-list.html` + `product-detail.html` (`FR-CAT-005`, `006`, `008`, `011`, `013`, `043`, `045`, `050`, `053`): the admin grid (all statuses, keyword/status/low-stock filters, pagination) and its read-only drill-down. Bundled as one issue since detail is a read-only projection of data the list already fetches, not an independent write surface (that's `M2.25`).

**Tasks**

- [ ] `getProducts` (admin, `Product` tag) query + `updateProductStatus`/`updateProductStock` mutations (`invalidatesTags: ["Product"]`) on the api slice
- [ ] List via `useGetAdminProductsQuery({page, sort, search, status, lowStock})` — filter/status/low-stock changes are just new args, refetched automatically
- [ ] Status filter and low-stock toggle, composing independently with search
- [ ] Read-only detail (route or drawer) via `useGetAdminProductByIdQuery`, rendering every field including embedded variants and per-unit purchasability (`FR-CAT-043`)
- [ ] Status-change via `useUpdateProductStatusMutation`; stock-only quick-edit via `useUpdateProductStockMutation`
- [ ] MSW handlers + RTL tests: filtered/paginated list, detail render, status change

**Test Criteria**

- List composes `search`/`status`/`lowStock` filters correctly and independently in the request
- Detail view renders every stored field, including all variants regardless of `active`
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.25 — admin-app: Product create/edit form (with embedded variant editor)

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/82-admin-product-form
**Labels:** frontend, admin-app, catalog

**Context**
Builds `mock-ui/admin-app/product-form.html` (`FR-CAT-001`–`004`, `033`, `038`, `083`–`087`) — the most complex admin screen: 1–8 image widget via presigned upload, category-scoped specification inputs, and an embedded variant editor. Depends on `M2.20`/`21`/`22`/`23`'s query endpoints to populate its pickers and dynamic inputs.

**Tasks**

- [ ] `createProduct`/`updateProduct` mutations (`invalidatesTags: ["Product"]`) and `addVariant`/`updateVariant` mutations on the api slice
- [ ] `src/features/products/productForm/` — create via `useCreateProductMutation`, edit via `useUpdateProductMutation` (`sku` field disabled on edit, not just validated — it's immutable per `FR-CAT-004`)
- [ ] Image widget: presigned upload generalized to 1–8 images with primary-image selection
- [ ] Category picker (via `M2.22`'s `useGetCategorySpecificationsQuery`) drives dynamic specification inputs from that category's schema, mirroring `FR-CAT-033`'s required/type/enum-membership checks client-side for UX only
- [ ] Embedded variant editor: add/edit rows inline (attributes from `M2.23`'s category variant axes, per-variant images/pricing/stock/`active`), via `useAddVariantMutation`/`useUpdateVariantMutation`
- [ ] Live-computed `sellingPrice` as `mrp`/`discount` are edited (mirrors `backend/src/utils/pricing.ts`'s formula for immediate feedback; still trusts the server value on save)
- [ ] Surface `SPECIFICATION_VALIDATION_FAILED`, `DUPLICATE_SKU`, and duplicate-attribute-set errors inline (from the mutation's `error`), naming every offending field
- [ ] MSW handlers + RTL tests: create, edit (sku disabled), variant add/edit, each validation error case

**Test Criteria**

- The `sku` field is disabled when editing an existing product
- Changing category re-fetches (via RTK Query arg change) and re-renders that category's specification/variant-axis inputs
- A `SPECIFICATION_VALIDATION_FAILED` response highlights every named offending field, not just the first
- `npm run build|test|lint --workspace admin-app` all pass

#### M2.26 — backend: variant-only pricing, drop inventory tracking (SRS v0.2 amendment)

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/102-variant-only-pricing
**Labels:** backend, catalog

**Context**
M2 (Issues #25–#36) shipped a product model where a product with zero active variants sells on its own `sku`/`mrp`/`discount`/`sellingPrice`/`stock`/`images`, and a product with one or more active variants sells per-variant instead (`FR-CAT-043`). This issue collapses that to **variant-only**: a product becomes pure metadata (name/description/brand/category/specifications/SEO/`isFeatured`) and every sellable, priced, imaged unit is a variant. Stock/inventory tracking is removed from the system entirely — not moved to the variant, deleted outright, along with the derived buyer-facing `availability` enum. A product now needs at least one active variant to be published. This is an SRS v0.2 amendment (`docs/srs/features/0.2-product-catalog.md`, `FR-CAT-001`, `003`, `004`, `008`, `009`, `011`, `039`, `042`, `043`, `056`, `059`, `064`, `068`, `073`–`076`, `083`, `084`, `087`, `091`, `092`, `095`, `096` all rewritten in place — no new FR numbers), not new scope, so it lands as its own issue against the already-complete M2 milestone rather than reopening #31/#32. Backend-only: `admin-app`/`buyer-app` product/variant screens are explicitly left out of sync with this API change and are deferred to separate follow-up work.

**Tasks**

- [ ] `products.model.ts`: remove `sku`/`images`/`mrp`/`discount`/`sellingPrice`/`stock`/`lowStockThreshold` from `ProductDocument`; remove `stock` from `ProductVariant`; make variant `images` schema-required (drop the empty-array default); keep `variants.sku` as the sole unique index
- [ ] `products.controller.ts`: drop the removed fields from `createProductSchema`/`updateProductSchema`/`addVariantSchema`/`updateVariantSchema`; delete `updateStockSchema`/`updateStockHandler`/the `PATCH .../stock` route; drop `lowStock` and the `mrp`/`stock` sort options from the admin list query; drop `inStock` from the buyer filter schema
- [ ] `products.service.ts`: trim `createProduct`/`updateProduct` to the new field set (delete `resolveImages`, the product-level image/price/stock handling, and the product-`sku` branch of `assertVariantSkuAvailable`); require 1–2 images unconditionally in `resolveVariantImages`; add a `PRODUCT_HAS_NO_VARIANTS` guard in `updateProductStatus` when transitioning to `"published"` with zero active variants; delete `updateStock`/`listAvailability`/`getPrimaryImage`/every `availability` field, sourcing list/detail image and price from `selectDefaultVariant()` unconditionally
- [ ] `products.repository.ts`: drop `inStockOnly`; fold `minPrice`/`maxPrice`/`onSaleOnly` into one variant-level `$elemMatch` (plain and Atlas paths); add an aggregation-based price-sort path (`$addFields` a computed `sortPrice` from active variants, since there's no top-level `sellingPrice` to sort on); drop `lowStock`; repoint admin SKU search at `variants.sku`
- [ ] Update `products.service.test.ts` and `__tests__/product-catalog/products/products.api.test.ts`: drop stock-endpoint/low-stock/availability tests and fixtures, add `PRODUCT_HAS_NO_VARIANTS` and variant-sourced price filter/sort tests
- [ ] SRS amendment: rewrite the FR list above in place in `docs/srs/features/0.2-product-catalog.md` (schema tables, endpoint table, worked examples, NFR checklist, UI/UX §6 prose, acceptance criteria); bump `docs/srs/SRS.md`'s Product Catalog FR-range summary
- [ ] `docs/postman/product-catalog/products.api.md` + `docs/postman/README.md`: strip removed fields from every example, delete the stock-endpoint section, add `PRODUCT_HAS_NO_VARIANTS`
- [ ] `backend/atlas-search/README.md`: drop the stale "in-stock" mention from its plain-query filter list
- [ ] `backend/CLAUDE.md`: append a summary entry once this issue's real number is known

**Test Criteria**

- `npm run build --workspace backend` and `npm run test --workspace backend` both pass with zero references to `stock`/`lowStockThreshold`/`availability` remaining in `products.*`
- Creating a product accepts no `sku`/`mrp`/`stock`/`images`; adding a variant requires `sku`, 1–2 images, and `mrp`/`discount` and rejects 0 or 3+ images
- `PATCH .../status` to `"published"` on a product with zero active variants returns `400 PRODUCT_HAS_NO_VARIANTS`; the same call succeeds once an active variant exists
- Buyer price-range, on-sale, and price-sort (`?sort=price_asc`/`price_desc`) all resolve against `variants[].sellingPrice`/`.discount`, not any product-level field
- No buyer-facing or admin response contains a `stock`, `lowStockThreshold`, or `availability` key anywhere

#### M2.27 — backend: shared parseQuery utility, categories/brands pagination+sort (SRS v0.2 amendment)

**Milestone:** M2 – Product Catalog
**Suggested branch:** feature/104-parse-query
**Labels:** backend, catalog

**Context**
Only the products admin list (`GET /api/admin/products`) currently supports pagination and sort — `products.controller.ts` hand-rolls its own `page`/`limit`/`sort` Zod schema plus a `parseSort()` helper turning a combined `?sort=-createdAt`-style enum into `{field, order}`. The categories and brands admin lists (`GET /api/admin/categories`, `GET /api/admin/brands`) support only `?search=` — no pagination, no sort, returning an unpaginated full array via `successResponse(data)` with no `pagination` key at all. This issue extracts a shared `backend/src/utils/parseQuery.ts` (pure functions, no I/O — same house style as `slug.ts`/`text.ts`/`pricing.ts`/`availability.ts`) that validates and normalizes `page`/`limit` (mirroring products' existing "oversized `limit` is rejected, not clamped" rule), a `sortBy` field name checked against a per-caller allow-list (an unrecognized field is rejected, not silently ignored), an `orderBy` of `"asc" | "desc" | "none"` (`"none"` = no sort applied), and an optional `filter` object merged alongside `search` into a Mongo-ready query. All three admin list endpoints are wired through it. Categories and brands gain pagination + sort for the first time; products' sort wire format changes from the single `?sort=-field` enum to two params, `?sortBy=<field>&orderBy=asc|desc|none`, matching the new shared shape. This is an SRS v0.2 amendment (`FR-CAT-005`, `017`, `026` rewritten in place in `docs/srs/features/0.2-product-catalog.md` to state "paginated, sortable" uniformly across all three admin lists — no new FR numbers, since this generalizes existing capability rather than adding new functional scope). Backend-only, same precedent as #102: `admin-app`'s product list request (currently `?sort=-createdAt`) and its categories/brands list UI are explicitly left out of sync with this API change and are deferred to a separate follow-up issue.

**Tasks**

- [ ] `backend/src/utils/parseQuery.ts` (new): pure function(s) validating/normalizing `page`/`limit`, `sortBy` against an allow-listed field array, `orderBy` (`"asc"|"desc"|"none"`), and merging an optional `filter` object with a `search` value into a Mongo-ready query piece
- [ ] `backend/src/utils/tests/parseQuery.test.ts` (new): Vitest unit tests mirroring `text.test.ts`/`availability.test.ts`'s one-`describe`-per-export style — happy path, invalid `sortBy`, oversized `limit`, `orderBy: "none"`
- [ ] `products.controller.ts`: replace `SORT_VALUES`/`parseSort`/the `sort` enum in `listQuerySchema` with `sortBy`/`orderBy` query params validated through `parseQuery`; `products.repository.ts`'s `listPaginated` keeps its existing `(filter, sort, page)` shape, now fed by `parseQuery`'s output
- [ ] `categories.controller.ts` + `categories.repository.ts` + `categories.service.ts`: add `page`/`limit`/`sortBy`/`orderBy` query params via `parseQuery`; repository's `list()` gains `.sort()`/`.skip()`/`.limit()` plus a `countDocuments()` for `total`; `listCategoriesForAdmin` returns `{items, pagination}` instead of a plain array; controller switches to the `successResponse(items, pagination)` overload
- [ ] `brands.controller.ts` + `brands.repository.ts` + `brands.service.ts`: identical shape change as categories
- [ ] Update `categories.service.test.ts`/`categories.api.test.ts` and `brands.service.test.ts`/`brands.api.test.ts` for the new pagination/sort behavior, following `products.service.test.ts`'s existing `listProductsForAdmin` test pattern
- [ ] SRS amendment: `FR-CAT-005`/`017`/`026` rewritten in place in `docs/srs/features/0.2-product-catalog.md`; endpoint table rows for `GET /api/admin/categories` and `GET /api/admin/brands` note pagination; §7 worked examples updated
- [ ] `docs/postman/product-catalog/{products,categories,brands}.api.md`: update sort query param docs to `sortBy`/`orderBy`, add a pagination example to the categories/brands list requests
- [ ] `backend/CLAUDE.md`: append a summary entry once this issue's real number is known

**Test Criteria**

- `npm run build --workspace backend` and `npm run test --workspace backend` both pass
- `GET /api/admin/products?sortBy=name&orderBy=desc` sorts correctly; an unrecognized `sortBy` value returns `400 VALIDATION_ERROR`
- `GET /api/admin/categories` and `GET /api/admin/brands` both accept `page`/`limit`/`sortBy`/`orderBy` and return a `pagination` object matching `FR-CAT-094`'s shape
- `orderBy=none` returns results with no explicit sort applied
- Existing `?search=` behavior on all three admin lists is unchanged

### mock-ui — End-to-end wireframes (v0.2 fix + v0.3–v0.7, v0.10)

Cross-cutting, not tied to a single milestone — mirrors how `mock-ui/` itself predated milestone tracking entirely before Issue #41 brought it under review. Unlike every `M<x>` backlog above, this section stays even after the issue is opened, following #41's own precedent for design/traceability work rather than the standard remove-on-open rule.

#### mock-ui.1 — Fix v0.2 staleness, extend end-to-end through Dashboard + Inventory Management

**Milestone:** none (cross-cutting)
**Suggested branch:** feature/200-mock-ui-end-to-end
**Labels:** documentation

**Context**
`mock-ui/` (static, unbuilt wireframes — `docs/architecture.md` §2) has had exactly 3 commits since it was created and covers only SRS v0.2 (Product Catalog): 4 `buyer-app` screens + 7 `admin-app` screens. It predates Issue #102's variant-only-pricing amendment, so 11 of its 17 files (`brand-kit.html`, `index.html`, `buyer-app/{home,category,product-detail,card-components}.html`, `admin-app/{table-component,product-list,product-form,product-detail}.html`, `README.md`) still show `stock`/low-stock columns and an availability badge that no longer exist anywhere in the real system.

Since then, SRS v0.3–v0.7 (Authentication, Shopping Cart, Orders, Payments, Dashboard) and v0.10 (Inventory Management) have all been spec-drafted with their own §6 UI/UX Requirements, and none of those screens has a mock-ui counterpart. This issue fixes the v0.2 staleness and extends `mock-ui/` end-to-end — sign-in through checkout, payment, dashboard, and stock management — so a stakeholder can click through the entire buyer and admin flow, not just the catalog. It mirrors Issue #41's own precedent (verify + extend mock-ui, traced against the SRS) but sized to the full flow instead of one milestone.

v0.10 reinstates a per-warehouse stock concept — the very thing the v0.2 fix below removes from the *catalog* screens. That's not a contradiction: v0.2's mocks drop stock because the product-catalog layer itself no longer carries it (Issue #102); v0.10 reintroduces it one layer down, surfaced only on its own Inventory screens and as a plain in-stock/out-of-stock signal elsewhere (product detail, cart) — never as a raw count on a catalog screen.

**Tasks**

_Fix — v0.2 staleness (11 files)_
- [ ] Remove every `stock`/low-stock/availability-badge reference from `brand-kit.html`, `index.html`, `buyer-app/home.html`, `buyer-app/category.html`, `buyer-app/product-detail.html`, `buyer-app/card-components.html`, `admin-app/table-component.html`, `admin-app/product-list.html`, `admin-app/product-form.html`, `admin-app/product-detail.html`, and `README.md` — layout/tokens unchanged, only the stale fields go

_Add — `buyer-app/` (8 new files)_
- [ ] `sign-in.html` — Google / One Tap / email OTP, no password field (`FR-AUTH-001`–`008`)
- [ ] `account-profile.html` — name/phone (`FR-AUTH-036`–`037`)
- [ ] `addresses.html` — address book: add/edit/delete/set default (`FR-ORD-028`–`032`)
- [ ] `cart.html` — line items, unavailable-line treatment, subtotal, plus an `INSUFFICIENT_STOCK` inline state (`FR-CART-010`–`018`, `FR-INV-010`)
- [ ] `checkout.html` — address step, order summary, the real Razorpay payment step, not a placeholder (`FR-ORD-001`–`007`, `025`–`027`, `033`, `FR-PAY-001`–`008`)
- [ ] `order-history.html` — paginated list (`FR-ORD-011`)
- [ ] `order-detail.html` — status timeline, cancel button, embedded payment summary (`FR-ORD-012`–`014`, `FR-PAY-028`)
- [ ] `account-home.html` — profile summary, 5 recent orders, lifetime spend (`FR-DASH-010`–`011`)
- [ ] `product-detail.html` — add an "out of stock" badge state replacing Add to Cart on a zero-stock variant (`FR-INV-007`–`008`); land alongside the v0.2 fix pass on the same file

_Add — `admin-app/` (8 new files)_
- [ ] `sign-in.html` — password step then a mandatory OTP step (`FR-AUTH-009`–`018`)
- [ ] `admin-users.html` — super-admin only: list, create, role/deactivate (`FR-AUTH-024`–`029`)
- [ ] `account-settings.html` — change password (`FR-AUTH-038`–`039`)
- [ ] `order-list.html` — status filter, search, pagination (`FR-ORD-017`)
- [ ] `order-detail.html` — status advance, cancel-with-reason, refund action (`FR-ORD-018`–`020`, `FR-PAY-015`–`018`)
- [ ] `dashboard.html` — role-scoped: order-manager/super-admin view (sales cards, revenue chart, top products) and catalog-manager view (catalog counts, out-of-stock count) as two states on one page, not two files (`FR-DASH-001`–`009`, `017`–`019`, `023`–`024`)
- [ ] `inventory.html` — Product/SKU/Warehouse/Stock table, warehouse filter, keyword search, pagination, inline-editable stock cell (`FR-INV-004`–`006`)
- [ ] `warehouses.html` — list + create form (`FR-INV-001`–`002`)
- [ ] No `admin-app` cart screen — v0.4 has no admin surface (`docs/srs/features/0.4-shopping-cart.md` §7); note this explicitly rather than silently omitting it

_Non-happy-path states_
- [ ] Carry the existing house style (skeleton/empty/error on listings, distinct empty states, inline guard rejections) into every new screen — e.g. checkout's dropped-items notice, an expired/invalid-OTP state on both sign-in flows, the refund-disabled-with-no-captured-payment state, the empty inventory table

_Traceability_
- [ ] Extend `README.md`'s "Catalog screens — SRS v0.2" / "Traceability to SRS v0.2 §6" section pattern with one matching subsection per module (v0.3–v0.7, v0.10) — file/screen/key-requirements table plus a §6-requirement → `FR-<CODE>-*` → file table, exactly like the existing v0.2 ones
- [ ] Update `index.html`'s link index to include every new page

**Test Criteria**

- None of the 17 original mock-ui files contains `stock`, `lowStock`, or an availability-badge reference after the fix pass
- Every one of the 16 new files exists, is reachable from `index.html`, and is annotated inline with the `FR-<CODE>-*` IDs it renders
- `README.md`'s traceability tables cover every §6 UI/UX bullet in `docs/srs/features/0.3-authentication.md` through `0.7-dashboard.md` and `0.10-inventory-management.md`
- `dashboard.html` and `product-detail.html` each visibly show both of their two states (role-scoped views; in-stock vs. out-of-stock) without needing two separate files
- Every page still opens directly via `file://` with no build step, matching the rest of `mock-ui/`

