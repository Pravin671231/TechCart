# Issue Drafts

**Project:** TechCart
**Status:** M0 (Foundation), M1 (CI Pipeline), and M2 (Product Catalog, backend only) are all opened as real GitHub Issues — #1–#10, and #25–#36 under [Milestone #3](https://github.com/Pravin671231/TechCart/milestone/3) respectively — so all three milestones' draft text has been removed from this file; see `docs/milestone.md` and `docs/srs/SRS.md` §6 for their roadmap-level and traceability records. The **Backlog** below holds the M2 addendum: `M2.13` (mock-ui verification, opened as Issue #41), `M2.14`–`M2.25` (the frontend build-out of every `mock-ui/` screen into real `buyer-app`/`admin-app` code, opened as Issues #71–#82, also under Milestone #3), `M2.26` (backend variant-only pricing / SRS v0.2 amendment, opened as Issue #102), and `M2.27` (backend shared parseQuery utility + categories/brands pagination+sort / SRS v0.2 amendment, opened as Issue #104) — draft text kept here for reference rather than removed, following `M2.13`'s own precedent.

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5. Once a milestone's issues are opened on GitHub, its draft section is removed from here — this happened for M2 as of Issues #25–#36.

**Scope of this file right now:** the M2 addendum (above) plus a full first draft of M3–M11 — every remaining SRS feature doc (`docs/srs/features/0.3-authentication.md` through `0.10-inventory-management.md`) is now spec-drafted, so this file adds all nine milestones' issues (`M3.1`–`M11.5`, 59 issues total) in one batch rather than one milestone at a time, since all eight docs landed together. M11 (Launch Readiness) is checklist-driven rather than `FR-`numbered, since SRS v1.1 (Final Consolidated) can't be honestly written until M3–M10 are actually implemented — see `M11.1`. Labels/milestones for M3–M11 are already created on GitHub; these sections move out of this file once each milestone's issues are opened for real via `gh issue create`, per the note above.

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

### M3 — Authentication

#### M3.1 — backend: Buyer passwordless authentication (Google OAuth/One Tap + email OTP)

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-buyer-passwordless-auth
**Labels:** backend, auth

**Context**
Establishes Better Auth with a Google OAuth/One Tap provider and an email-OTP plugin for buyers — the first real identity in the system (`FR-AUTH-001`–`008`, `023`). Every later buyer-scoped feature (Cart v0.4, Orders v0.5) depends on the `users` collection and session model this issue creates.

**Tasks**
- [ ] Install/configure Better Auth with the MongoDB adapter (`backend/src/lib/auth.ts`), a Google OAuth provider, and an email-OTP plugin
- [ ] Mount Better Auth's handler at `/api/auth/*`
- [ ] Extend `users` with `role` (default `buyer`), `status`, `phone`, `lastSignInAt` via Better Auth's `additionalFields` config
- [ ] Implement `POST /api/auth/one-tap`, verifying the Google Identity Services credential and resolving/creating a buyer account (`FR-AUTH-002`)
- [ ] Ensure all three buyer entry points resolve to one account by email (`FR-AUTH-005`) and reject a client-supplied `role` (`FR-AUTH-004`)
- [ ] Reject a buyer sign-in whose email belongs to a non-buyer account with a specific error (`FR-AUTH-006`)
- [ ] Configure Resend for OTP delivery (`FR-AUTH-003`), 10-minute single-use expiry (`FR-AUTH-007`)
- [ ] Supertest: OAuth callback (mocked), One Tap verify, OTP send+verify, duplicate-email resolution, admin-email-on-buyer-route rejection

**Test Criteria**
- A first-time Google/One Tap/OTP sign-in creates exactly one `buyer` account; a later sign-in via a different method with the same email reuses it
- An OTP is rejected once expired or reused
- A buyer sign-in for an email already registered as an admin returns a specific, non-500 error
- `npm run test --workspace backend` passes

#### M3.2 — backend: Admin password + mandatory OTP sign-in and session

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-admin-password-otp-auth
**Labels:** backend, auth

**Context**
Admin sign-in is a two-step challenge — password then a mandatory OTP — distinct from the buyer flow (`FR-AUTH-009`–`018`, `030`). Depends on `M3.1`'s Better Auth setup and reuses its email-OTP plugin for the admin step.

**Tasks**
- [ ] `POST /api/auth/sign-in/email`: validate credentials, issue a short-lived signed challenge (not a session) on success, trigger an OTP email (`FR-AUTH-009`, `011`)
- [ ] `POST /api/auth/email-otp/verify`: validate challenge+code, establish the session only once both succeed (`FR-AUTH-012`, `014`)
- [ ] Distinct error codes: wrong password/unknown email identical (`FR-AUTH-010`), wrong/expired/used OTP (`FR-AUTH-012`)
- [ ] `GET /api/auth/session` returns the public profile for either a buyer or admin session (`FR-AUTH-018`)
- [ ] `POST /api/auth/sign-out` invalidates the session server-side (`FR-AUTH-017`)
- [ ] Session cookie: `httpOnly`/`secure`/`sameSite=lax`, 30-day rolling lifetime (`FR-AUTH-015`–`016`)
- [ ] Supertest: password-then-OTP happy path, wrong password, wrong/expired/reused OTP, password-alone/OTP-alone insufficient, sign-out invalidation

**Test Criteria**
- A correct password alone never establishes a session; correct password + correct OTP does
- The session cookie carries `httpOnly`/`secure`/`sameSite=lax` in a production-like config
- A signed-out session's cookie is rejected on reuse
- `npm run test --workspace backend` passes

#### M3.3 — backend: Admin password reset

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-admin-password-reset
**Labels:** backend, auth

**Context**
Self-service recovery for an admin who forgets their password (`FR-AUTH-019`–`022`); buyers have no password so have no equivalent. Depends on `M3.2`'s admin credential model.

**Tasks**
- [ ] `POST /api/auth/forgot-password`: identical response regardless of whether the email is registered (`FR-AUTH-019`); Resend a single-use, 1-hour reset link on a match (`FR-AUTH-020`–`021`)
- [ ] `POST /api/auth/reset-password`: validate the token, update the password, invalidate every existing session for that admin (`FR-AUTH-022`)
- [ ] Supertest: registered vs. unregistered response equality, valid reset, expired/reused token rejection, session invalidation after reset

**Test Criteria**
- Requesting a reset for a registered and an unregistered email return identical responses
- A reset link is rejected after 1 hour, and on a second use even inside that window
- Completing a reset invalidates every session for that admin
- `npm run test --workspace backend` passes

#### M3.4 — backend: Admin account provisioning (seed script + super-admin user management)

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-admin-provisioning
**Labels:** backend, auth

**Context**
There's no in-app admin bootstrap — the first super-admin comes from a one-time seed script, after which a super-admin manages further admin accounts through dedicated endpoints (`FR-AUTH-024`–`029`). Depends on `M3.1`'s `users` schema.

**Tasks**
- [ ] `backend/src/scripts/seed/superAdmin.ts`: reads email/name/password from env vars, creates the account idempotently (skip if it already exists)
- [ ] `POST /api/admin/users` (super-admin only): create an admin of any of the three roles with a temporary password (`FR-AUTH-025`)
- [ ] `PATCH /api/admin/users/:id`: update role or deactivate; deactivation invalidates a live session synchronously within the same request (`FR-AUTH-026`)
- [ ] `GET /api/admin/users`: paginated, searchable list — name/email/role/status/`lastSignInAt` (`FR-AUTH-027`)
- [ ] Reject an admin deactivating/deleting their own account (`FR-AUTH-028`)
- [ ] Confirm a newly created admin's first sign-in goes through the identical password+OTP flow — no bypass (`FR-AUTH-029`)
- [ ] Supertest: seed idempotency, create/list/update, self-deactivation rejection, deactivation session invalidation

**Test Criteria**
- Running the seed script twice does not create a duplicate super-admin
- A super-admin can create a `catalog-manager` and an `order-manager`, both able to sign in immediately
- Deactivating an admin invalidates their live session on the very next request
- A super-admin cannot deactivate or delete their own account
- `npm run test --workspace backend` passes

#### M3.5 — backend: RBAC guard replacing X-Admin-Key, createdBy/updatedBy backfill

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-rbac-guard
**Labels:** backend, auth

**Context**
Replaces Product Catalog's temporary `X-Admin-Key` middleware (`backend/src/middleware/adminAuth.ts`, `FR-CAT-088`–`090`) with a real session+role guard at the identical mount point — no catalog route/controller/service change, fulfilling the swap `FR-CAT-090` promised (`FR-AUTH-031`–`035`). Depends on `M3.2`'s session model.

**Tasks**
- [ ] `backend/src/middleware/rbac.ts`: two-stage guard — session presence (401) then role membership (403), parameterized by allowed roles per route
- [ ] Remove `backend/src/middleware/adminAuth.ts` and its `X-Admin-Key`/`ADMIN_KEY` env var entirely
- [ ] Wire `rbac(["catalog-manager","super-admin"])` onto every existing catalog route (products, categories, brands, `categorySpecifications`, `categoryVariants`, uploads)
- [ ] Populate `createdBy`/`updatedBy` on every catalog write from `req.user.id` instead of `null`
- [ ] Supertest: 401 vs. 403 distinction, `order-manager` rejected on catalog routes, `createdBy`/`updatedBy` populated correctly

**Test Criteria**
- Every `/api/admin/*` catalog route rejects no-session with 401 and wrong-role with 403, verified as two distinct outcomes
- `X-Admin-Key` no longer exists anywhere in `backend` — env var, middleware, and every reference removed
- A product created by a signed-in `catalog-manager` stores their real user ID in `createdBy`
- `npm run test --workspace backend` passes

#### M3.6 — backend: Buyer profile and admin self-service password

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-account-self-service
**Labels:** backend, auth

**Context**
Small, session-scoped "my own account" endpoints distinct from admin-managing-other-admins (`M3.4`) — a buyer profile and an admin change-password capability, neither overlapping the other's role (`FR-AUTH-036`–`039`).

**Tasks**
- [ ] `backend/src/modules/account/`: `GET`/`PATCH /api/account/profile` (buyer, name/phone only — `FR-AUTH-036`–`037`)
- [ ] `POST /api/account/change-password` (admin, current-password required — `FR-AUTH-038`)
- [ ] A successful password change invalidates every other session for that admin, current one intact (`FR-AUTH-039`)
- [ ] Supertest: profile view/update, unauthenticated rejection, password-change happy path + wrong-current-password rejection, other-session invalidation

**Test Criteria**
- A signed-in buyer can view and update name/phone; unauthenticated requests are rejected 401
- An admin's password change with the correct current password succeeds and invalidates every other session, leaving the current one intact
- `npm run test --workspace backend` passes

#### M3.7 — backend: Abuse mitigation (rate limiting) and error contract

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-auth-rate-limiting
**Labels:** backend, auth

**Context**
Auth-specific rate limiting that can't wait for the system-wide policy in v0.8 (`docs/architecture.md` §6) — five independently-limited surfaces, plus the error-code contract every prior M3 issue's endpoints rely on (`FR-AUTH-040`–`045`). Lands after `M3.1`–`M3.6`, since it wraps their endpoints.

**Tasks**
- [ ] Redis-backed rate limiters (existing Upstash instance) on: admin sign-in/OTP-verify (`040`), admin OTP-resend (`041`), admin forgot-password (`042`), buyer OTP-request (`043`), Google OAuth callback/One Tap (`044`) — each independent
- [ ] Confirm every code in `FR-AUTH-045`'s list is distinct and stable: invalid credentials, account deactivated, session expired, insufficient role, OTP required, OTP invalid, OTP expired, admin-email-on-buyer-route
- [ ] Supertest: each rate limit independently triggerable; full error-code enumeration test

**Test Criteria**
- Exceeding any one of the five rate limits returns 429 without affecting the other four
- Every error code in `FR-AUTH-045` is distinguishable by `code` alone in a dedicated test
- `npm run test --workspace backend` passes

#### M3.8 — buyer-app: Sign-in (Google/One Tap/OTP) and session bootstrap

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-buyer-signin
**Labels:** buyer-app, auth

**Context**
`buyer-app`'s first auth surface — no password field anywhere. Depends on `M3.1`'s backend endpoints.

**Tasks**
- [ ] `src/features/auth/`: sign-in screen — "Continue with Google" button, auto-triggered One Tap prompt on load, and an email+OTP path (email entry → OTP entry with resend-cooldown)
- [ ] A `getSession` query (`GET /api/auth/session`) called once on app load to bootstrap header/nav state
- [ ] Header/nav: signed-out (sign-in entry) vs. signed-in (account menu, sign out) states
- [ ] Handle `GOOGLE_ACCOUNT_IS_ADMIN`/`OTP_INVALID`/`OTP_EXPIRED` with distinct inline messages
- [ ] MSW handlers + RTL tests: Google button render, OTP request/verify flow, expired/invalid-code state, session bootstrap

**Test Criteria**
- Requesting and verifying an OTP establishes a session and updates header state with no page reload
- An expired/invalid OTP renders a distinct error, not a generic failure message
- `npm run build|test|lint --workspace buyer-app` all pass

#### M3.9 — buyer-app: Account profile

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-buyer-account-profile
**Labels:** buyer-app, auth

**Context**
The buyer-facing half of `M3.6`'s profile endpoint.

**Tasks**
- [ ] `src/features/account/`: profile view/edit form (name/phone), its own success/error state
- [ ] No change-password screen — buyers have no password (§7)
- [ ] MSW handlers + RTL tests: view, edit success, edit validation error

**Test Criteria**
- Updating name/phone persists and re-renders from the mutation response
- `npm run build|test|lint --workspace buyer-app` all pass

#### M3.10 — admin-app: Password→OTP sign-in flow and route guard

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-admin-signin
**Labels:** admin-app, auth

**Context**
Replaces `M2.19`'s throwaway `X-Admin-Key` prompt entirely with real session-based sign-in — the `admin-app` half of `M3.2`/`M3.5`. Two screens in sequence; no sign-up link anywhere.

**Tasks**
- [ ] Remove `src/features/adminKey/` and its `authSlice`/`X-Admin-Key` header wiring from the api slice entirely
- [ ] `src/features/auth/`: password form → (on `OTP_REQUIRED`) OTP-entry screen with resend-cooldown
- [ ] Route guard: redirect to sign-in on 401/no session; render a distinct "no access" state on 403
- [ ] `INVALID_CREDENTIALS`/`OTP_INVALID`/`OTP_EXPIRED`/`ACCOUNT_DEACTIVATED` each render distinct messages
- [ ] MSW handlers + RTL tests: full flow happy path, each error state, 401 vs. 403 route-guard distinction

**Test Criteria**
- No `admin-app` request carries an `X-Admin-Key` header anywhere in the codebase after this issue
- A 401 redirects to sign-in; a 403 renders a distinct "no access" state
- `npm run build|test|lint --workspace admin-app` all pass

#### M3.11 — admin-app: Admin user management and self-service password change

**Milestone:** M3 – Authentication
**Suggested branch:** feature/<TBD>-admin-user-management
**Labels:** admin-app, auth

**Context**
The `admin-app` half of `M3.4` (super-admin only) and `M3.6` (any admin, self-service). Depends on `M3.10`'s route guard for role-based nav hiding.

**Tasks**
- [ ] `src/features/adminUsers/` (super-admin only, hidden from nav for other roles): list (name/email/role/status/last sign-in), create form, role/deactivate controls; no delete/deactivate control on the signed-in super-admin's own row
- [ ] `src/features/account/`: change-password form with its own success/error state
- [ ] MSW handlers + RTL tests: list/create/deactivate, self-row-guard, password-change happy path + wrong-current-password error

**Test Criteria**
- A super-admin can create, list, and deactivate other admin accounts
- The signed-in super-admin's own row never shows a deactivate/delete control
- `npm run build|test|lint --workspace admin-app` all pass

### M4 — Shopping Cart

#### M4.1 — backend: Cart identity and line items

**Milestone:** M4 – Shopping Cart
**Suggested branch:** feature/<TBD>-cart-core
**Labels:** backend, cart

**Context**
Core cart CRUD — one persistent cart per authenticated buyer, lazily created, variant-only line items (`FR-CART-001`–`009`). Depends on M3 (buyer session) and v0.2 Catalog (variant references).

**Tasks**
- [ ] `backend/src/modules/cart/`: `carts` collection (`user`, `items: [{variant, quantity}]`)
- [ ] `GET /api/cart`, `POST /api/cart/items`, `PATCH`/`DELETE /api/cart/items/:variantId`, `DELETE /api/cart`
- [ ] Session-required guard on every endpoint — 401 without one (`FR-CART-002`)
- [ ] Lazy cart creation on first add (`FR-CART-001`)
- [ ] Dedupe-by-variant on add (`FR-CART-004`); quantity capped 1–10, rejected not clamped (`FR-CART-005`)
- [ ] Reject a nonexistent variant ID (`FR-CART-009`)
- [ ] Supertest coverage

**Test Criteria**
- Adding the same variant twice combines into one line
- Quantity 11 is rejected; 0–10 is accepted; updating to 0 removes the line
- Every endpoint requires a session
- `npm run test --workspace backend` passes

#### M4.2 — backend: Pricing, availability, response envelope

**Milestone:** M4 – Shopping Cart
**Suggested branch:** feature/<TBD>-cart-pricing
**Labels:** backend, cart

**Context**
Cart reads always resolve live pricing/availability from the referenced variant, never a stored snapshot (`FR-CART-010`–`018`). Depends on `M4.1`'s cart CRUD.

**Tasks**
- [ ] Live price/subtotal resolution on every `GET` (`FR-CART-010`–`011`)
- [ ] `unavailable` flag for a deactivated variant/unpublished product, excluded from `subtotal` (`FR-CART-012`)
- [ ] Over-cap quantity flagged the same way (`FR-CART-013`)
- [ ] `itemCount` including unavailable lines (`FR-CART-017`)
- [ ] Empty-cart shape for a buyer with nothing added (`FR-CART-016`)
- [ ] `{success,data}` envelope, no `pagination` key ever (`FR-CART-018`)
- [ ] Supertest: price-change reflection, unavailable flagging, subtotal/`itemCount` correctness

**Test Criteria**
- Changing a variant's `mrp`/`discount` changes the cart's displayed price on the next `GET`, with no cart-side update
- Deactivating a variant already in a cart flags that line unavailable and excludes it from `subtotal`
- A brand-new buyer receives 200 with empty `items`, never 404
- `npm run test --workspace backend` passes

#### M4.3 — buyer-app: Cart page and header mini-cart

**Milestone:** M4 – Shopping Cart
**Suggested branch:** feature/<TBD>-buyer-cart-page
**Labels:** buyer-app, cart

**Context**
The primary cart UI, consuming `M4.1`/`M4.2`'s endpoints.

**Tasks**
- [ ] `src/features/cart/`: cart page — line items (image/name/attributes/qty stepper/remove), unavailable-line treatment (dimmed, excluded from subtotal, removable), subtotal summary, checkout button disabled at zero available lines
- [ ] Header mini-cart badge from `itemCount`, optimistic update on add/remove
- [ ] Empty-cart state distinct from loading
- [ ] MSW handlers + RTL tests: render, quantity update, remove, unavailable-line display, empty state

**Test Criteria**
- The cart page renders live pricing and an accurate subtotal excluding unavailable lines
- The header badge updates optimistically on add/remove
- `npm run build|test|lint --workspace buyer-app` all pass

#### M4.4 — buyer-app: Add-to-cart auth gating and "Go to Cart" state

**Milestone:** M4 – Shopping Cart
**Suggested branch:** feature/<TBD>-buyer-cart-gating
**Labels:** buyer-app, cart

**Context**
Every cart entry point routes on session state alone — no anonymous mutation is ever possible, even transiently (`FR-CART-019`–`021`). Depends on `M3.8`'s session bootstrap and `M4.3`'s cart data.

**Tasks**
- [ ] Header cart icon: signed-in → Cart section, unauthenticated → Login section (`FR-CART-019`)
- [ ] Add-to-cart control (product card quick-add + product detail): an unauthenticated click routes to Login instead of performing the add (`FR-CART-020`)
- [ ] A signed-in buyer whose cart already contains a card's variant sees "Go to Cart" instead, navigating to the Cart section; reverts to "Add to Cart" if that line is removed (`FR-CART-021`), derived from already-cached cart contents — no per-card API call
- [ ] MSW handlers + RTL tests: unauthenticated icon/add-to-cart routing, "Go to Cart" state + reversion

**Test Criteria**
- An unauthenticated click on the cart icon or Add to Cart lands on Login with no cart mutation
- A product card already in the signed-in buyer's cart shows "Go to Cart"; removing that line reverts it
- `npm run build|test|lint --workspace buyer-app` all pass

### M5 — Orders

#### M5.1 — backend: Buyer address book

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-address-book
**Labels:** backend, orders

**Context**
Standalone account data a buyer manages independent of order lifecycle (`FR-ORD-028`–`032`) — checkout (`M5.2`) references it but doesn't own it. Depends on M3 (buyer session).

**Tasks**
- [ ] `backend/src/modules/addresses/`: `addresses` collection (`user`, `fullName`, `phone`, `line1`, `line2?`, `city`, `state`, `pincode`, `isDefault`)
- [ ] `POST`/`GET /api/addresses`, `PATCH`/`DELETE /api/addresses/:id`, `PATCH /api/addresses/:id/default`
- [ ] Every read/mutation derives the owner from the session and filters `{_id,user}` in one query — never fetch-by-ID-then-check (`FR-ORD-030`)
- [ ] Setting a new default clears the previous one; deleting the current default leaves no default, never auto-reassigned (`FR-ORD-031`)
- [ ] PIN code validated as a 6-digit Indian postal code
- [ ] Supertest: CRUD happy path, cross-buyer ownership rejection (identical to not-found), default-toggle behavior

**Test Criteria**
- A buyer can add, view, update, and delete their own addresses; another buyer's address ID returns the same error as a nonexistent one
- Setting a new default clears the previous one; deleting the current default leaves none set
- `npm run test --workspace backend` passes

#### M5.2 — backend: Checkout (order creation)

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-checkout
**Labels:** backend, orders

**Context**
Turns a cart into an order — the core of this milestone (`FR-ORD-001`–`007`, `025`–`027`, `033`). Depends on `M5.1`'s address book, v0.4 Cart, and v0.2 Catalog.

**Tasks**
- [ ] `backend/src/modules/orders/`: `orders` collection with frozen line-item and `shippingAddress` snapshots (`FR-ORD-003`, `026`)
- [ ] `POST /api/orders`: accepts `addressId`, an inline address (saved as a side effect), or neither (falls back to the default address, rejected if none exists — `FR-ORD-004`, `033`)
- [ ] Server-computed `totalAmount` in integer paise, never client-trusted (`FR-ORD-005`, `027`)
- [ ] Atomic order-creation + cart-clear (`FR-ORD-006`); sequential human-readable `orderNumber` (`FR-ORD-007`)
- [ ] Commit-time re-validation dropping newly-unavailable lines into a `droppedItems` response field rather than failing checkout (`FR-ORD-025`)
- [ ] Reject checkout on a cart with zero available lines (`FR-ORD-002`)
- [ ] Supertest: full checkout happy path, address fallback/rejection, dropped-line race condition, client-supplied total ignored

**Test Criteria**
- Checkout with at least one available line creates a `pending_payment` order with a unique order number and clears the ordered lines from the cart
- Checkout with neither `addressId` nor an inline address uses the default when one exists, and is rejected otherwise
- A line unavailable at commit time is dropped and reported in `droppedItems`, without failing the rest of checkout
- `npm run test --workspace backend` passes

#### M5.3 — backend: Order status lifecycle and auto-cancel job

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-order-lifecycle
**Labels:** backend, orders

**Context**
The fixed state machine every other order-touching issue in this milestone (and Payments, v0.6) relies on (`FR-ORD-008`–`010`). Depends on `M5.2`'s order model.

**Tasks**
- [ ] Enforce the state graph `pending_payment → paid → processing → shipped → delivered`, with `cancelled`/`refunded` off-ramps; reject any other transition
- [ ] Internal, routeless `markOrderPaid(orderId, paymentId)` — reserved for Payments (v0.6), not reachable by any role or route (`FR-ORD-009`)
- [ ] Scheduled job auto-cancelling a `pending_payment` order after 30 minutes, recorded in `statusHistory` (`FR-ORD-010`)
- [ ] Supertest: every legal/illegal transition, auto-cancel job behavior

**Test Criteria**
- Every legal transition succeeds; every illegal one is rejected with an error naming both statuses
- An order left `pending_payment` past 30 minutes is auto-cancelled with the transition recorded
- `npm run test --workspace backend` passes

#### M5.4 — backend: Buyer order history, detail, and cancellation

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-buyer-orders
**Labels:** backend, orders

**Context**
The buyer-facing read/action surface (`FR-ORD-011`–`016`). Depends on `M5.2`/`M5.3`.

**Tasks**
- [ ] `GET /api/orders`: paginated, own orders only, newest first (`FR-ORD-011`)
- [ ] `GET /api/orders/:id`: full detail, ownership enforced in the query itself — a non-owned ID returns the same error as a nonexistent one (`FR-ORD-012`)
- [ ] `statusHistory` entry appended on every transition, visible on the buyer's own detail view (`FR-ORD-013`)
- [ ] `POST /api/orders/:id/cancel`: buyer-only, restricted to `pending_payment`/`paid` (`FR-ORD-014`)
- [ ] Supertest: history pagination, ownership-safe detail lookup, cancellation status-gate

**Test Criteria**
- A buyer's order list shows only their own orders; a non-owned order ID returns the same error as a nonexistent one
- A `pending_payment`/`paid` order can be cancelled; a `processing`-or-later one is rejected, naming the current status
- `npm run test --workspace backend` passes

#### M5.5 — backend: Admin order management

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-admin-orders
**Labels:** backend, orders

**Context**
The `order-manager`/`super-admin` surface, with `catalog-manager` explicitly excluded — the reciprocal of the boundary v0.3 drew around catalog routes (`FR-ORD-017`–`020`). Depends on `M5.2`/`M5.3` and v0.3's RBAC guard.

**Tasks**
- [ ] `GET /api/admin/orders`: paginated, sortable, status-filterable, searchable by order number or buyer email (`FR-ORD-017`)
- [ ] `GET /api/admin/orders/:id`: full detail plus the ordering buyer's identity (`FR-ORD-018`)
- [ ] `PATCH /api/admin/orders/:id/status`: advance along the legal state graph, optional tracking reference on `shipped` (`FR-ORD-019`)
- [ ] `POST /api/admin/orders/:id/cancel`: required reason, same status gate as buyer cancellation (`FR-ORD-015`)
- [ ] `rbac(["order-manager","super-admin"])` on every route — `catalog-manager` rejected 403 (`FR-ORD-020`)
- [ ] Supertest: list/search/filter, status advance, role-boundary rejection

**Test Criteria**
- An `order-manager` can list, search, filter, view, and advance the status of any order
- A `catalog-manager` session is rejected 403 on every `/api/admin/orders/*` route
- `npm run test --workspace backend` passes

#### M5.6 — backend: Order notification emails

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-order-notifications
**Labels:** backend, orders

**Context**
Best-effort email side effects on checkout and status transitions, via the existing BullMQ worker process (`FR-ORD-021`–`023`). Depends on `M5.2`–`M5.5`'s transition points.

**Tasks**
- [ ] Enqueue an order-confirmation email job on successful checkout — never sent inline (`FR-ORD-021`)
- [ ] Enqueue a notification job on each of `paid`/`shipped`/`delivered`/`cancelled` (`FR-ORD-022`)
- [ ] A failed email send never fails or rolls back the triggering transition — BullMQ's normal retry policy applies (`FR-ORD-023`)
- [ ] Supertest: job enqueued per transition, transition succeeds independent of email outcome

**Test Criteria**
- A successful checkout enqueues exactly one confirmation job without waiting on it sending
- Each of `paid`/`shipped`/`delivered`/`cancelled` enqueues its own job when reached
- `npm run test --workspace backend` passes

#### M5.7 — buyer-app: Address book screen

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-buyer-address-book
**Labels:** buyer-app, orders

**Context**
The buyer-facing half of `M5.1`, in the account area.

**Tasks**
- [ ] `src/features/addresses/`: list of saved addresses with add/edit/delete and "set as default" actions, reusing v0.4's empty/loading/error state patterns
- [ ] MSW handlers + RTL tests: list, add/edit/delete, default-toggle

**Test Criteria**
- A buyer can add, edit, delete, and set a default address, with the list reflecting each change
- `npm run build|test|lint --workspace buyer-app` all pass

#### M5.8 — buyer-app: Checkout flow

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-buyer-checkout
**Labels:** buyer-app, orders

**Context**
The primary conversion screen, consuming `M5.2`'s checkout endpoint and `M5.7`'s address data. Ends at order creation — payment is v0.6.

**Tasks**
- [ ] `src/features/checkout/`: order summary from the current cart, a shipping-address step (saved-address radio-select, default pre-selected, inline "add new address" form)
- [ ] Submit step ending at order creation with a "payment coming next" placeholder, pending v0.6
- [ ] Surface any `droppedItems` in the response clearly before proceeding
- [ ] MSW handlers + RTL tests: address selection, inline add, dropped-items surfacing, order-creation success

**Test Criteria**
- Checkout renders the cart summary and the buyer's saved addresses, defaulting to their default address
- A response with `droppedItems` surfaces them before the buyer proceeds further
- `npm run build|test|lint --workspace buyer-app` all pass

#### M5.9 — buyer-app: Order history and detail

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-buyer-order-history
**Labels:** buyer-app, orders

**Context**
Consumes `M5.4`'s buyer-facing endpoints.

**Tasks**
- [ ] `src/features/orders/`: history list (order number, date, status badge, total), paginated
- [ ] Order detail: line items, shipping address, a visual status timeline from `statusHistory`, cancel button shown only while `pending_payment`/`paid`
- [ ] MSW handlers + RTL tests: list render/pagination, detail render, cancel action + status-gated visibility

**Test Criteria**
- The history list paginates correctly; the detail view's status timeline reflects every recorded transition
- The cancel button is present only for `pending_payment`/`paid` orders
- `npm run build|test|lint --workspace buyer-app` all pass

#### M5.10 — admin-app: Order list and detail/status/cancel

**Milestone:** M5 – Orders
**Suggested branch:** feature/<TBD>-admin-orders
**Labels:** admin-app, orders

**Context**
Consumes `M5.5`'s admin endpoints; role-gated so a `catalog-manager` session never sees the Orders nav entry (matching the server-side 403). Reuses `admin-app`'s existing `Table`/`Pagination`/`SortableHeader` components.

**Tasks**
- [ ] `src/features/orders/`: list — order number, buyer email, date, status, total; status filter, search, pagination
- [ ] Detail: full line items, shipping address, status timeline, a status-advance control constrained to legal next states only (never a free-form dropdown), cancel action with a required reason field
- [ ] Hide the Orders nav entry entirely for a `catalog-manager` session
- [ ] MSW handlers + RTL tests: list/filter/search, status advance (legal-only options), cancel with reason, nav visibility by role

**Test Criteria**
- The status-advance control never offers an illegal next state
- A `catalog-manager` session never renders the Orders nav entry
- `npm run build|test|lint --workspace admin-app` all pass

### M6 — Payments

#### M6.1 — backend: Payment initiation and Razorpay order creation

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-payment-initiation
**Labels:** backend, payments

**Context**
Creates the gateway-side Razorpay order and returns checkout params to `buyer-app` (`FR-PAY-001`–`004`, `022`). Depends on v0.5 Orders (payment always references an order) and a provisioned Razorpay merchant account.

**Tasks**
- [ ] `backend/src/modules/payments/`: `payments` collection (`order`, `razorpayOrderId`, `amount`, `status`, `webhookEvents`)
- [ ] `POST /api/orders/:id/payment`: owner-only, `pending_payment`-only gate (`FR-PAY-002`); create or reuse a live `payments` record (`FR-PAY-003`–`004`)
- [ ] Return only the public key ID and Razorpay order ID — never the key secret (`FR-PAY-022`)
- [ ] Supertest: initiation happy path, ownership/status gate rejection, reuse-on-repeat-call

**Test Criteria**
- Initiating on the buyer's own `pending_payment` order returns a Razorpay order ID and key ID; on another buyer's order or a non-`pending_payment` order it's rejected
- Initiating twice against the same still-valid payment reuses the same Razorpay order
- `npm run test --workspace backend` passes

#### M6.2 — backend: Client-side verification and `paid` transition

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-payment-verify
**Labels:** backend, payments

**Context**
The synchronous confirmation path — fulfills v0.5's `FR-ORD-009` seam (`FR-PAY-005`–`008`). Depends on `M6.1`.

**Tasks**
- [ ] `POST /api/orders/:id/payment/verify`: HMAC-verify the submitted signature before trusting any payload field (`FR-PAY-006`)
- [ ] On success: update `payments` to `captured`, call `markOrderPaid()` (`FR-PAY-007`)
- [ ] On failure: reject, order stays `pending_payment`
- [ ] Supertest: valid signature happy path, tampered signature rejection

**Test Criteria**
- A valid signature transitions the payment to `captured` and the order to `paid`
- A tampered signature is rejected and the order stays `pending_payment`
- `npm run test --workspace backend` passes

#### M6.3 — backend: Webhook handler and idempotency

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-payment-webhook
**Labels:** backend, payments

**Context**
The asynchronous, authoritative confirmation path — equally valid as `M6.2`'s client-side one and idempotent against it (`FR-PAY-009`–`014`, `020`–`021`, `023`–`024`). Depends on `M6.1`/`M6.2`.

**Tasks**
- [ ] `POST /api/webhooks/razorpay`: verify against the raw, unparsed body (`FR-PAY-023`); exempt from the session/RBAC guard, authenticated by signature alone, at an unlisted path (`FR-PAY-024`)
- [ ] Idempotent by Razorpay event ID — a redelivered event is acknowledged without reapplying its effect (`FR-PAY-011`)
- [ ] `payment.captured` drives the identical `captured`/`paid` transition as `M6.2`; whichever arrives first wins, the second is a no-op (`FR-PAY-012`)
- [ ] `payment.failed` updates the payment to `failed`, order stays `pending_payment` (`FR-PAY-013`)
- [ ] Every event appended to `webhookEvents` regardless of effect (`FR-PAY-014`)
- [ ] An event for an already-terminal order is logged and acknowledged without changing order status (`FR-PAY-020`–`021`)
- [ ] Independent rate limit on the webhook endpoint
- [ ] Supertest: signature rejection, idempotent redelivery, race with `M6.2`'s verify path, terminal-order event

**Test Criteria**
- An invalid webhook signature is rejected before any write
- Redelivering the same `payment.captured` event twice results in exactly one `paid` transition
- Whichever of client-verify or webhook arrives first performs the transition; the second is a no-op, not an error
- `npm run test --workspace backend` passes

#### M6.4 — backend: Refunds

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-refunds
**Labels:** backend, payments

**Context**
Admin-initiated full/partial refunds, confirmed authoritatively by webhook (`FR-PAY-015`–`018`). Depends on `M6.1`–`M6.3` and v0.3's `order-manager`/`super-admin` roles.

**Tasks**
- [ ] `POST /api/admin/orders/:id/refund`: `order-manager`/`super-admin` only; amount defaults to the full refundable balance, reason required (`FR-PAY-015`)
- [ ] Reject an amount exceeding captured-minus-already-refunded (`FR-PAY-016`)
- [ ] Order transitions to `refunded` once cumulative refunds equal the full captured amount; a partial refund is tracked on the payment record only (`FR-PAY-017`)
- [ ] `refund.processed` webhook event confirms completion, mirroring `M6.3`'s idempotency pattern (`FR-PAY-018`)
- [ ] Supertest: full refund, partial refund, over-refund rejection, webhook confirmation

**Test Criteria**
- A full refund on a `paid` order succeeds and transitions the order to `refunded`
- A partial refund succeeds without changing order status until the cumulative amount reaches the full captured amount
- A refund request exceeding the refundable balance is rejected
- `npm run test --workspace backend` passes

#### M6.5 — backend: Retry/eligibility and response envelope

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-payment-retry-envelope
**Labels:** backend, payments

**Context**
Closes out the milestone's remaining requirements: payment retry after failure, ineligibility once an order is terminal, and the money/envelope conventions every prior M6 issue's endpoints should already follow (`FR-PAY-019`, `025`–`028`). Depends on `M6.1`–`M6.4`.

**Tasks**
- [ ] Confirm a failed payment attempt can be retried on the same order without creating a new order (`FR-PAY-019`)
- [ ] Confirm initiation is blocked once an order is auto-cancelled or otherwise terminal (already covered by `M6.1`'s status gate — verify, don't re-implement)
- [ ] Audit every M6 endpoint for `{success,data}`/`{success:false,code,message}` compliance and integer-paise amounts (`FR-PAY-025`–`026`)
- [ ] Confirm `payments` documents are never hard-deleted, only status-transitioned (`FR-PAY-027`)
- [ ] Buyer-facing order detail includes only the payment summary (`status`, amount, method) — never the full `payments` document (`FR-PAY-028`)
- [ ] Supertest: retry-after-failure, envelope/summary-projection audit

**Test Criteria**
- A failed payment attempt can be retried on the same order
- The buyer-facing order detail response never includes Razorpay identifiers or the full `payments` document
- `npm run test --workspace backend` passes

#### M6.6 — buyer-app: Checkout payment step

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-buyer-payment-step
**Labels:** buyer-app, payments

**Context**
Replaces `M5.8`'s "payment coming next" placeholder with the real Razorpay checkout widget.

**Tasks**
- [ ] Launch Razorpay's checkout widget using `M6.1`'s response; on success, call `M6.2`'s verify endpoint and redirect to order confirmation
- [ ] On widget failure/dismissal, return the buyer to a retry state on the same order rather than restarting checkout
- [ ] Order detail: render the embedded payment summary (status/amount/method) alongside the existing status timeline
- [ ] MSW handlers + RTL tests: widget success path (mocked), failure/retry path, payment summary render

**Test Criteria**
- A successful mocked payment redirects to order confirmation with the order shown as `paid`
- A failed/dismissed payment returns to a retry state on the same order, not a fresh checkout
- `npm run build|test|lint --workspace buyer-app` all pass

#### M6.7 — admin-app: Refund action on order detail

**Milestone:** M6 – Payments
**Suggested branch:** feature/<TBD>-admin-refund
**Labels:** admin-app, payments

**Context**
Extends `M5.10`'s order detail screen with `M6.4`'s refund endpoint.

**Tasks**
- [ ] Refund form on order detail — amount (defaulting to the full refundable balance), required reason; disabled entirely when no captured payment exists
- [ ] Show prior partial-refund history when present
- [ ] MSW handlers + RTL tests: full refund, partial refund, disabled state, over-refund rejection message

**Test Criteria**
- The refund form is disabled when the order has no captured payment
- A successful refund updates the order detail's payment summary and refund history
- `npm run build|test|lint --workspace admin-app` all pass

### M7 — Dashboard

#### M7.1 — backend: Admin sales summary, time series, and top products

**Milestone:** M7 – Dashboard
**Suggested branch:** feature/<TBD>-dashboard-sales
**Labels:** backend, dashboard

**Context**
The `order-manager`/`super-admin` operational view (`FR-DASH-001`–`006`, `017`–`019`). Depends on v0.5 Orders and v0.6 Payments for the underlying figures.

**Tasks**
- [ ] `backend/src/modules/dashboard/`: `GET /api/admin/dashboard/summary` — totals, revenue net of refunds, per-status order counts, range-scoped (`001`–`004`)
- [ ] `GET /api/admin/dashboard/sales` — day/week-bucketed revenue series, zero-filled gaps (`005`, `018`)
- [ ] `GET /api/admin/dashboard/top-products` — top 10 by revenue, units-sold tiebreak (`006`, `017`)
- [ ] Validate `from`/`to`: reject invalid/reversed ranges, default to last 30 days, reject spans over 1 year (`002`, `019`)
- [ ] Redis-cache each response for 60s, keyed by endpoint + query params (shared with `M7.3`)
- [ ] Supertest: known-data aggregation correctness, range validation, cache-hit behavior

**Test Criteria**
- Summary/series/top-products figures match a manual aggregation of the same underlying data
- A range over 1 year is rejected; an omitted range defaults to the last 30 days
- Two identical requests within 60s return identical figures even if underlying data changed in between
- `npm run test --workspace backend` passes

#### M7.2 — backend: Catalog summary, including out-of-stock count

**Milestone:** M7 – Dashboard
**Suggested branch:** feature/<TBD>-dashboard-catalog-summary
**Labels:** backend, dashboard

**Context**
The `catalog-manager`-scoped view, reciprocal to `M7.1`'s role boundary (`FR-DASH-007`, `020`–`021`, `023`–`024`). The out-of-stock count is blocked until v0.10 Inventory Management ships — implement the endpoint's other counts now and add the count once `inventory` exists, omitting the field entirely (not zero-filling it) until then.

**Tasks**
- [ ] `GET /api/admin/dashboard/catalog-summary`: live-computed product-status/category/brand counts, no denormalized counter table (`007`, `020`)
- [ ] `rbac(["catalog-manager","super-admin"])`; `order-manager` rejected 403 (`021`)
- [ ] Out-of-stock count (`023`–`024`): omitted from the response until v0.10's `inventory` collection exists; implement as a feature-flagged/conditional field once it does, computed live, never zero-filled as a stand-in for "not implemented"
- [ ] Supertest: count correctness, role-boundary rejection, out-of-stock field absence pre-v0.10

**Test Criteria**
- Catalog-summary counts match a manual count of the underlying collections
- An `order-manager` session is rejected 403 on this endpoint
- The out-of-stock field is absent from the response until v0.10 ships, never present as `0` by default
- `npm run test --workspace backend` passes

#### M7.3 — backend: Buyer dashboard endpoint and caching

**Milestone:** M7 – Dashboard
**Suggested branch:** feature/<TBD>-dashboard-buyer
**Labels:** backend, dashboard

**Context**
A compact buyer account-home summary, distinct from v0.5's full order history (`FR-DASH-010`–`014`). Depends on v0.5 Orders.

**Tasks**
- [ ] `GET /api/account/dashboard`: profile essentials + 5 most recent orders (`010`)
- [ ] Lifetime order count and amount spent, net of refunds (`011`)
- [ ] 401 for an unauthenticated request (`012`)
- [ ] Reuse `M7.1`'s 60s Redis-caching pattern
- [ ] Supertest: recent-orders cap, lifetime-figure correctness, unauthenticated rejection

**Test Criteria**
- The response shows at most 5 recent orders and correct lifetime count/spend net of refunds
- An unauthenticated request is rejected 401
- `npm run test --workspace backend` passes

#### M7.4 — admin-app: Dashboard screen

**Milestone:** M7 – Dashboard
**Suggested branch:** feature/<TBD>-admin-dashboard
**Labels:** admin-app, dashboard

**Context**
Role-gated views consuming `M7.1`/`M7.2` — Recharts per `docs/architecture.md` §4.2.

**Tasks**
- [ ] `order-manager`/`super-admin` view: summary cards, revenue-over-time chart, top-products table, date-range control that re-fetches all three on change
- [ ] `catalog-manager` view: narrower cards (product/category/brand counts, out-of-stock count once v0.10 lands), no date-range control
- [ ] MSW handlers + RTL tests: both role views, date-range change refetch

**Test Criteria**
- The date-range control re-fetches summary/series/top-products together on change
- A `catalog-manager` session never renders the sales/revenue widgets
- `npm run build|test|lint --workspace admin-app` all pass

#### M7.5 — buyer-app: Account-home screen

**Milestone:** M7 – Dashboard
**Suggested branch:** feature/<TBD>-buyer-account-home
**Labels:** buyer-app, dashboard

**Context**
Consumes `M7.3`; a landing summary that links out to `M5.9`'s full order history rather than duplicating it.

**Tasks**
- [ ] `src/features/accountHome/`: profile summary, 5 most recent orders (each linking to its full detail), lifetime order count/spend
- [ ] MSW handlers + RTL tests: render, empty-history state (new buyer)

**Test Criteria**
- The screen renders at most 5 recent orders and correct lifetime figures from a mocked response
- `npm run build|test|lint --workspace buyer-app` all pass

### M8 — Backend NFRs

An audit-and-harden pass across everything built in M2–M7, not new business logic — each issue's Test Criteria is a verification against the *existing* codebase, per `docs/srs/features/0.8-backend-nfr.md` §1.

#### M8.1 — backend: Performance and scalability

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-performance
**Labels:** backend, backend-nfr

**Context**
Connection resilience, caching conventions, and a real load-test baseline (`FR-NFR-BE-001`–`005`).

**Tasks**
- [ ] Document a p95 latency target (<300ms) for every list/paginated endpoint against a seeded representative dataset
- [ ] Explicitly configure the MongoDB connection pool/timeout settings in `backend/.env.example`
- [ ] Automatic reconnection with exponential backoff; a request during a reconnect window fails fast with a specific 503 (`FR-NFR-BE-003`)
- [ ] Document a general-purpose Redis caching key-naming/TTL convention (beyond Dashboard's existing use)
- [ ] Run and record a load test (k6/Artillery) against the three highest-traffic buyer endpoints at 50 concurrent users, results in `backend/docs/architecture.md`

**Test Criteria**
- A simulated MongoDB disconnect results in reconnection and a 503 (not a hang) for requests during the gap
- The recorded load test meets the documented p95 target
- `npm run test --workspace backend` passes

#### M8.2 — backend: Database

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-database
**Labels:** backend, backend-nfr

**Context**
Index audit and backup verification across every collection introduced since M2 (`FR-NFR-BE-006`–`008`).

**Tasks**
- [ ] Audit every index declared in each feature SRS doc's §3 against `db.collection.getIndexes()`; correct any drift found
- [ ] Confirm every collection's primary query path uses an index, except the two already-documented accepted exceptions (`FR-CAT-050`–`052`'s admin name-search regex)
- [ ] Document the MongoDB Atlas backup/restore procedure; test-run a restore against a non-production cluster
- [ ] Supertest/manual verification of index presence where automatable

**Test Criteria**
- Every index from every prior feature's SRS doc exists in the deployed database
- A documented backup restore succeeds against a non-production cluster
- `npm run test --workspace backend` passes

#### M8.3 — backend: Security hardening

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-security
**Labels:** backend, backend-nfr

**Context**
The exhaustive rate-limit/`helmet`/cookie/CORS/secrets audit every prior feature's own NFR checklist deferred here (`FR-NFR-BE-009`–`015`).

**Tasks**
- [ ] Apply `helmet` to every response (standard security headers, baseline CSP)
- [ ] A rate-limit policy on every route category, sized to risk — not just auth/checkout/payment/webhook (already done per-feature) but public browsing too
- [ ] Audit every session cookie's `httpOnly`/`secure`/`sameSite` against the actual production TLS/origin config
- [ ] Audit the existing CORS allowlist against wildcard-subdomain/protocol-mismatch attempts
- [ ] Route-by-route audit confirming every admin-writable endpoint enforces both auth and role (`FR-AUTH-023`–`025`)
- [ ] Add `npm audit` (or equivalent) to CI, failing on a high/critical finding with an available fix
- [ ] Repo-wide search confirming no secret is ever logged, committed, or returned in a response

**Test Criteria**
- Every response carries `helmet`'s standard headers
- Exceeding any route category's rate limit returns 429
- A route-by-route audit confirms every admin-writable endpoint enforces auth + role, with no gaps found
- `npm run test --workspace backend` passes

#### M8.4 — backend: API and error-handling audit

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-api-audit
**Labels:** backend, backend-nfr

**Context**
Contract-consistency verification plus operational hardening (`FR-NFR-BE-016`–`019`).

**Tasks**
- [ ] System-wide integration-test pass asserting every error response matches `{success:false,code,message}`
- [ ] Graceful `SIGTERM` handling — stop accepting connections, drain in-flight requests up to a timeout, close the MongoDB connection cleanly
- [ ] Deepen `/health` to report MongoDB/Redis connection state, not just process liveness
- [ ] Gzip/brotli compression above a minimum payload size

**Test Criteria**
- A system-wide test pass confirms every error response matches the standard contract
- Sending `SIGTERM` drains in-flight requests and exits cleanly with no dropped request
- `/health` reports dependency state, not just liveness
- `npm run test --workspace backend` passes

#### M8.5 — backend: Observability

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-observability
**Labels:** backend, backend-nfr

**Context**
Structured logging, error tracking, and an admin audit trail (`FR-NFR-BE-020`–`024`).

**Tasks**
- [ ] Pino structured JSON logging with a request-ID correlating each request's log lines
- [ ] Lint rule failing CI on any `console.log` in a request-handling path
- [ ] Wire Sentry for `backend`, capturing unhandled exceptions/rejections with request ID, route, non-PII context
- [ ] New `adminAuditLog` collection (append-only) recording every admin-privileged mutation — who/when/what
- [ ] Redaction list at the logger config level: password, session token, payment signature, and full payment/webhook request bodies never logged

**Test Criteria**
- Every log line for a request carries a correlating request ID
- A deliberately thrown unhandled exception appears in Sentry with request context
- An admin-privileged mutation produces a corresponding `adminAuditLog` entry
- A targeted test confirms a password/payment signature never appears in a log line
- `npm run test --workspace backend` passes

#### M8.6 — backend: Configuration and operations

**Milestone:** M8 – Backend NFRs
**Suggested branch:** feature/<TBD>-nfr-config-ops
**Labels:** backend, backend-nfr

**Context**
Closes the remaining M8 requirements: env validation, an API-versioning stance, and BullMQ failure visibility (`FR-NFR-BE-025`–`028`).

**Tasks**
- [ ] Extend `env.ts` validation to cover every secret/config value introduced since v0.2; a missing required variable fails startup loudly in every environment
- [ ] Document an API-versioning stance (no versioning at this scale vs. an actual `/api/v1` prefix) in `docs/architecture.md`
- [ ] BullMQ dead-letter/failure-visibility — a job exhausting retries is logged at minimum, ideally surfaced to Sentry
- [ ] Confirm §2's retroactive-scope requirement: this milestone's fixes apply to every route/module built in M2–M7, not only new code

**Test Criteria**
- Removing a required environment variable fails startup with a clear error, in every environment
- A job forced to exhaust its retries is visibly logged, not silently dropped
- `npm run test --workspace backend` passes

### M9 — Frontend NFRs

Same audit character as M8, across `buyer-app`/`admin-app` instead of `backend` — a fix-existing-screens pass, not new screens, per `docs/srs/features/0.9-frontend-nfr.md` §1.

#### M9.1 — buyer-app/admin-app: Performance pass

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-performance
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
Core Web Vitals targets for `buyer-app`, a recorded bundle-size baseline for `admin-app` (`FR-NFR-FE-001`–`004`).

**Tasks**
- [ ] Lighthouse CI against `buyer-app`'s four ISR routes (home, category, product detail, search) with LCP/CLS/INP targets
- [ ] Confirm every catalog image goes through `next/image` with explicit dimensions, not a bare `<img>`
- [ ] Confirm `buyer-app`'s bundle is code-split per route (e.g. the Razorpay widget script never loads on the home page)
- [ ] Measure and record `admin-app`'s initial and largest-route bundle sizes in `admin-app/docs/architecture.md`

**Test Criteria**
- Lighthouse CI reports LCP/CLS/INP within target on all four routes
- No bare `<img>` renders a catalog image anywhere in `buyer-app`
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.2 — buyer-app/admin-app: Responsiveness and browser support

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-responsive
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
A breakpoint and browser-matrix audit across every existing screen (`FR-NFR-FE-005`–`008`).

**Tasks**
- [ ] Visually verify every `buyer-app` screen at 375px/768px/1280px — no horizontal scroll, no clipped/overlapping content
- [ ] Visually verify every `admin-app` screen at its existing sidebar breakpoints plus a functional mobile fallback
- [ ] Document a browser-support matrix (current + 1 prior major of Chrome/Firefox/Safari/Edge); smoke-test every screen against it
- [ ] Fix any gap found at either step

**Test Criteria**
- Every screen in both apps renders correctly at its documented breakpoints, with fixes applied for any gap found
- The browser-support matrix is documented in each app's `docs/architecture.md`
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.3 — buyer-app/admin-app: Accessibility audit and fixes

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-accessibility
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
The deepest-scoped M9 issue — WCAG 2.1 AA across every screen built since M2 (`FR-NFR-FE-009`–`014`), the area most likely to have silently drifted across eleven independently-built screens.

**Tasks**
- [ ] Automated axe-core scan against every screen in both apps; fix every critical/serious violation found
- [ ] Manual keyboard-only pass: every interactive element reachable, operable, with a visible focus indicator, in a logical order
- [ ] Confirm every image carries real `alt` text (or `alt=""` for decorative images) as actually rendered, not just present server-side
- [ ] Confirm every form label is programmatically associated with its input and validation errors are screen-reader-announced
- [ ] Color-contrast audit against the actual rendered palette (4.5:1 normal text, 3:1 large text/UI)
- [ ] Focus-trap + focus-return on every modal/dialog (e.g. `admin-app`'s `AlertModal`)

**Test Criteria**
- An axe-core scan against every screen in both apps reports zero critical/serious violations
- Tabbing through any screen reaches every interactive element in logical order with a visible focus indicator at each stop
- Opening `AlertModal` traps focus; closing it returns focus to the triggering element
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.4 — buyer-app/admin-app: UX consistency audit

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-ux-consistency
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
Confirms loading/empty/error-state and destructive-action-confirmation consistency across every screen built independently in M2–M7 (`FR-NFR-FE-015`–`017`).

**Tasks**
- [ ] Audit every data-fetching screen in both apps for loading, empty, and error states; fix any missing one
- [ ] Audit every destructive admin action (delete/deactivate/cancel/refund) for `AlertModal` confirmation, not immediate execution
- [ ] Audit every user-visible error message for specificity — no raw stack traces, no generic "Something went wrong," no unhandled promise rejections visible in the UI

**Test Criteria**
- Every data-fetching screen in both apps has all three of loading/empty/error states
- Every destructive admin action across every admin screen routes through `AlertModal`
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.5 — buyer-app/admin-app: Frontend security audit

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-frontend-security
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
Bundle-secret, XSS-surface, CSP, and client-storage audit across both apps (`FR-NFR-FE-018`–`021`).

**Tasks**
- [ ] Inspect both apps' built bundles for any secret beyond the public Razorpay key ID and `NEXT_PUBLIC_API_URL`
- [ ] Repo-wide search for `dangerouslySetInnerHTML` (or equivalent raw-HTML injection); document justification/sanitization for any found, remove any unjustified usage
- [ ] Set a baseline Content-Security-Policy on both apps (coordinated with M8's backend headers)
- [ ] Confirm no client-storable "signed in" credential exists beyond the `httpOnly` session cookie — any client-side auth flag is derived from `GET /api/auth/session`, never stored

**Test Criteria**
- Inspecting both built bundles finds no secret beyond the two allowed public values
- A repo-wide search finds no unjustified `dangerouslySetInnerHTML` usage
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.6 — buyer-app/admin-app: Sentry and RUM

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-sentry
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
The client-side half of M8.5's observability work (`FR-NFR-FE-022`–`023`).

**Tasks**
- [ ] Wire Sentry for both `buyer-app` and `admin-app`, capturing unhandled exceptions with route/breadcrumb context, no PII beyond what's already visible in the UI
- [ ] Enable a Real User Monitoring signal (Vercel Analytics or Sentry Performance) on `buyer-app`, tracking `M9.1`'s Core Web Vitals targets against real traffic

**Test Criteria**
- A deliberately thrown exception in either app appears in Sentry with route context
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

#### M9.7 — buyer-app/admin-app: Retroactive-scope wrap-up and accepted-gaps doc

**Milestone:** M9 – Frontend NFRs
**Suggested branch:** feature/<TBD>-nfr-wrapup
**Labels:** buyer-app, admin-app, frontend-nfr

**Context**
Closes the milestone: confirms every fix from `M9.1`–`M9.6` didn't regress its originating feature's own acceptance criteria, and records any gap deliberately left unaddressed (`FR-NFR-FE-024`–`026`).

**Tasks**
- [ ] Re-run each touched screen's originating feature's acceptance criteria (e.g. v0.2 §8, v0.5 §8) to confirm no regression from `M9.1`–`M9.6`'s fixes
- [ ] Document any accepted, deliberately-not-fixed gap (e.g. Razorpay's own checkout iframe's accessibility, which this codebase can't fully control) in `docs/srs/features/0.9-frontend-nfr.md` §10

**Test Criteria**
- Every feature whose screens were touched by `M9.1`–`M9.6` still passes its own originating acceptance criteria
- Any accepted gap is documented, not silently left unaddressed
- `npm run build|test|lint --workspace buyer-app` and `--workspace admin-app` all pass

### M10 — Inventory Management

Issue split follows `docs/srs/features/0.10-inventory-management.md` §2.5's own workspace breakdown.

#### M10.1 — backend: Warehouses, inventory collection, admin CRUD, buyer availability

**Milestone:** M10 – Inventory Management
**Suggested branch:** feature/<TBD>-inventory-core
**Labels:** backend, inventory

**Context**
Reinstates a per-warehouse stock concept that Issue #102 deliberately removed from Product Catalog — this time split across 2–3 fixed warehouses rather than a single field (`FR-INV-001`–`008`, `012`). Depends on v0.2 Catalog (variant identity) and v0.3 Auth (`catalog-manager` role guard).

**Tasks**
- [ ] `backend/src/modules/inventory/`: `warehouses` collection (`name`, `code`, `active`); `inventory` collection, one row per `(variantId, warehouseId)`, unique-indexed
- [ ] `POST`/`GET /api/admin/warehouses` (`FR-INV-001`–`002`)
- [ ] `GET /api/admin/inventory`: paginated table (product × variant × warehouse × stock), `warehouseId`/`search` filters (`FR-INV-004`)
- [ ] `PATCH /api/admin/inventory/:inventoryId`: absolute `stock` update via atomic `$set`, negative values rejected with `NEGATIVE_STOCK_REJECTED` (`FR-INV-005`–`006`)
- [ ] Compute buyer-facing `availability` (`in_stock`/`out_of_stock`, summed across warehouses) on `GET /api/products`, `/api/products/:slug`, `/api/categories/:slug/products` (`FR-INV-007`)
- [ ] Reject adding an out-of-stock variant to cart at the API, not just hiding it client-side (`FR-INV-008` — coordinate with `M10.2`/v0.4 Cart)
- [ ] Supertest: warehouse CRUD, inventory table pagination/filtering, negative-stock rejection, availability computation

**Test Criteria**
- Setting a variant's stock to 5 in one warehouse and 0 in another shows `in_stock` on the buyer-facing read
- A negative `stock` update is rejected with `NEGATIVE_STOCK_REJECTED`
- A variant with total stock 0 across all warehouses shows `out_of_stock`
- `npm run test --workspace backend` passes

#### M10.2 — backend: Cart↔stock allocation

**Milestone:** M10 – Inventory Management
**Suggested branch:** feature/<TBD>-inventory-cart-allocation
**Labels:** backend, inventory

**Context**
Warehouse-allocation logic inside Cart's mutation endpoints (`FR-INV-009`–`011`) — **blocked until v0.4 Shopping Cart's backend module exists**; do not start this issue before `M4.1`/`M4.2` are merged. Open now for tracking, per the SRS doc's own forward-reference framing.

**Tasks**
- [ ] On `POST /api/cart/items`: pick the first warehouse (by creation order) with `stock >= quantity`, decrement it atomically, store the chosen `warehouseId` on the cart line (`FR-INV-009`)
- [ ] If no single warehouse can fulfill the quantity, reject with `INSUFFICIENT_STOCK`, naming the largest available single-warehouse quantity — no cross-warehouse splitting (`FR-INV-010`)
- [ ] On `PATCH`/`DELETE /api/cart/items/:id`: re-check/restore stock at the line's already-allocated warehouse (`FR-INV-011`)
- [ ] Supertest: successful allocation, `INSUFFICIENT_STOCK` rejection, quantity-increase re-check, removal-restores-stock

**Test Criteria**
- Adding 3 to cart decrements the chosen warehouse's stock by 3 and records that `warehouseId` on the line
- Requesting more than any single warehouse can fulfill is rejected with `INSUFFICIENT_STOCK`, naming the available count
- Removing the cart line restores stock to the originally-allocated warehouse
- `npm run test --workspace backend` passes

#### M10.3 — admin-app: Inventory table and warehouses screen

**Milestone:** M10 – Inventory Management
**Suggested branch:** feature/<TBD>-admin-inventory
**Labels:** admin-app, inventory

**Context**
Consumes `M10.1`'s endpoints, reusing existing `TableLayout`/`Pagination`/`SortableHeader` components (Issues #107/#108).

**Tasks**
- [ ] New "Inventory" nav section: one table view — Product, SKU, Warehouse, Stock columns, warehouse filter, keyword search, pagination
- [ ] Inline-editable stock cell (click → numeric input → save), surfacing `NEGATIVE_STOCK_REJECTED` inline
- [ ] Small "Warehouses" screen — list + create form, no edit/delete needed at 2–3 fixed locations
- [ ] MSW handlers + RTL tests: table render/filter/search, inline stock edit + rejection, warehouse create

**Test Criteria**
- The inventory table filters by warehouse and searches by product/SKU keyword correctly
- An inline stock edit to a negative value shows `NEGATIVE_STOCK_REJECTED` without navigating away
- `npm run build|test|lint --workspace admin-app` all pass

#### M10.4 — buyer-app: Availability badge and out-of-stock disable

**Milestone:** M10 – Inventory Management
**Suggested branch:** feature/<TBD>-buyer-availability
**Labels:** buyer-app, inventory

**Context**
Consumes `M10.1`'s `availability` field on the product detail page (`productDetail` feature, M2.18) — no warehouse information is ever shown to a buyer.

**Tasks**
- [ ] "Out of stock" label/badge replacing the add-to-cart control on a variant with `availability: "out_of_stock"`
- [ ] Inline error naming the available count when a cart action hits `INSUFFICIENT_STOCK` (from `M10.2`)
- [ ] MSW handlers + RTL tests: out-of-stock badge render, insufficient-stock inline error

**Test Criteria**
- A variant with `availability: "out_of_stock"` shows the badge in place of Add to Cart, never a raw stock number
- An `INSUFFICIENT_STOCK` response renders the available count inline
- `npm run build|test|lint --workspace buyer-app` all pass

### M11 — Launch Readiness

Checklist-driven, no `FR-` IDs — SRS v1.1 (Final Consolidated SRS) is deliberately not drafted until M3–M10 are actually implemented (`docs/srs/SRS.md` §7). Every issue below should be picked up only once the milestones it consolidates/hardens are functionally complete.

#### M11.1 — Consolidate every feature SRS into one final SRS.md v1.1

**Milestone:** M11 – Launch Readiness
**Suggested branch:** feature/<TBD>-srs-v1-1-consolidation
**Labels:** documentation, launch-readiness

**Context**
`docs/srs/SRS.md` §7 defines v1.1 as "Complete" only once every prior version (v0.2–v0.10) is itself Complete — implemented and validated, not just spec-drafted. This issue merges every `docs/srs/features/*.md` into one consolidated system SRS once that's true.

**Tasks**
- [ ] Confirm every feature version v0.2–v0.10 is marked Complete in `SRS.md`'s Version History before starting
- [ ] Merge every feature doc's FR/NFR list, data model, and API contract into one consolidated `docs/srs/SRS.md` v1.1 document
- [ ] Reconcile any cross-doc amendment left inline in an individual feature doc (e.g. v0.10's amendment to v0.7's catalog-summary) into the consolidated version
- [ ] Update the Version History, Feature Index, and Traceability Matrix to reflect v1.1 as the current, complete version

**Test Criteria**
- Every FR/NFR ID across every feature appears exactly once in the consolidated document
- `SRS.md`'s own Version History marks v1.1 Complete only after this issue merges

#### M11.2 — India/Razorpay compliance pages

**Milestone:** M11 – Launch Readiness
**Suggested branch:** feature/<TBD>-compliance-pages
**Labels:** buyer-app, launch-readiness

**Context**
Razorpay's KYC/activation process requires published policy pages on the live domain before a merchant account goes live (`SRS.md` §2.6).

**Tasks**
- [ ] Refund policy, shipping policy, and privacy policy pages on `buyer-app`
- [ ] GST display on order/invoice-facing screens per India tax requirements
- [ ] Link all three policy pages from the footer

**Test Criteria**
- All three policy pages are live and linked from the footer
- GST is displayed correctly on relevant order screens

#### M11.3 — Load test at realistic catalog/order volume

**Milestone:** M11 – Launch Readiness
**Suggested branch:** feature/<TBD>-launch-load-test
**Labels:** backend, launch-readiness

**Context**
M8.1's load test covered three buyer endpoints in isolation; this is a full-system pass across catalog + checkout + payment flows together, at realistic production-scale data volume, ahead of go-live.

**Tasks**
- [ ] Seed a production-realistic dataset (catalog size, order history volume)
- [ ] Run a combined load test across browsing, cart, checkout, and payment-initiation flows
- [ ] Record results and any remediation taken in `docs/architecture.md`

**Test Criteria**
- The combined load test meets or exceeds M8.1's per-endpoint p95 targets under realistic data volume
- Results and any fixes are documented

#### M11.4 — Production monitoring and alerting wired end-to-end

**Milestone:** M11 – Launch Readiness
**Suggested branch:** feature/<TBD>-launch-monitoring
**Labels:** infra, launch-readiness

**Context**
Extends M8.5's/M9.6's Sentry wiring with alerting rules and dashboards actually configured for the production environment — logging/error-tracking existing is not the same as someone being paged when it matters.

**Tasks**
- [ ] Configure Sentry alert rules (error-rate thresholds, new-issue notifications) for all three apps' production projects
- [ ] Configure uptime/health-check monitoring against the deployed `/health` endpoint
- [ ] Document the on-call/response process for a production alert

**Test Criteria**
- A deliberately triggered production-like error surfaces an alert through the configured channel
- The monitoring/alerting setup is documented

#### M11.5 — Final go-live checklist sign-off

**Milestone:** M11 – Launch Readiness
**Suggested branch:** feature/<TBD>-go-live-checklist
**Labels:** documentation, launch-readiness

**Context**
The last issue in the roadmap — a single checklist confirming every prior milestone's exit criteria (per `docs/milestone.md`) is actually met before declaring the system launch-ready.

**Tasks**
- [ ] Verify every milestone M0–M10's exit criteria against the live system, not just against merged PRs
- [ ] Confirm `M11.1`–`M11.4` are all complete
- [ ] Record final sign-off in `docs/architecture.md` §10 and tag the release per `docs/architecture.md` §8's versioning convention

**Test Criteria**
- Every milestone's exit criteria is verified against the live system with no open gaps
- A final release tag is cut following the documented versioning convention
