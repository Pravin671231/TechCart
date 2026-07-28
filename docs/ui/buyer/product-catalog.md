# buyer-app — Product Catalog UI

**Project:** TechCart
**Feature:** Product Catalog (SRS v0.2, feature code `CAT`)
**Scope:** The four storefront screens — catalog listing, category, product detail, search results. The header, container, design guidelines and shared components they sit inside are specified once in the main doc
**Status:** Draft — derived from the `mock-ui/buyer/` prototype, raised to a normative target for implementation
**Related:** [buyer/buyer-main-ui.md](buyer-main-ui.md) (design guidelines, layout, shared components, conventions); [docs/srs/features/0.2-product-catalog.md](../../srs/features/0.2-product-catalog.md) §6 (the requirements these screens realize); [admin/product-catalog.md](../admin/product-catalog.md) (the same feature, console side); [mock-ui/buyer/](../../../mock-ui/buyer/) (clickable prototype)

Product Catalog is the only feature with a specified buyer UI, and it is the whole storefront today: browsing, filtering, searching, and viewing a product. Everything a buyer can currently do is one of the four screens below. `docs/srs/features/0.2-product-catalog.md` §6 owns _what_ these screens must let a buyer do; this document owns _how_ they look and behave.

---

## Contents

1. [Pages](#1-pages)
2. [UI Design Details](#2-ui-design-details)
3. [Page-by-page Wireframes](#3-page-by-page-wireframes)
4. [UI Behavior and Interactions](#4-ui-behavior-and-interactions)
5. [Requirements Traceability](#5-requirements-traceability)

---

## 1. Pages

| Route                 | Page            | Rendering      | Purpose                                     | Requirements                                    | Wireframe                   |
| --------------------- | --------------- | -------------- | ------------------------------------------- | ----------------------------------------------- | --------------------------- |
| `/` (catalog root)    | Catalog listing | ISR            | Browse and filter every published product   | `FR-CAT-001`, `005`–`009`, `040`, `052`         | [§3.1](#31-catalog-listing) |
| category page by slug | Category        | ISR            | The same listing, scoped to one category    | `FR-CAT-002`, plus everything in §3.1           | [§3.2](#32-category)        |
| product page by slug  | Product detail  | ISR            | Everything about one product, variant-aware | `FR-CAT-003`, `008`, `044`, `050`, `051`, `053` | [§3.3](#33-product-detail)  |
| search page, `?q=`    | Search results  | Client-fetched | Keyword results across name and description | `FR-CAT-004`, `006`, `007`, `010`               | [§3.4](#34-search-results)  |

Rendering strategy per route is fixed by [docs/architecture.md](../../architecture.md) §4.1 — search is client-fetched because its results are query-dependent and not usefully cacheable. All four sit inside the storefront shell ([buyer-main-ui.md §5](buyer-main-ui.md#5-layout-structure)).

---

## 2. UI Design Details

### What this feature brings

| Surface                 | Count | Notes                                                                                     |
| ----------------------- | ----- | ----------------------------------------------------------------------------------------- |
| **Product grids**       | 3     | Catalog listing, category, search — one shared grid, capped at three columns              |
| **Product cards**       | —     | The grid's unit: image, brand, name, price block, stock badge                             |
| **Filter sidebar**      | 2     | Catalog listing and category. Category tree, brand, price range, variant-attribute facets |
| **Toolbars**            | 3     | Result count + sort control above each grid; search adds a Relevance option               |
| **Two-column detail**   | 1     | Product detail — gallery beside the information column                                    |
| **Variant selector**    | 1     | One control group per attribute axis, driving price, stock and images together            |
| **Specification table** | 1     | Grouped name/value pairs on the product detail page                                       |

### Components this feature introduces

Shell and multi-feature components — pagination, breadcrumb, skeleton, empty state, error state, forms, buttons — are in [buyer-main-ui.md §7](buyer-main-ui.md#7-ui-components).

| Component    | Spec                                                                                                                                                                                                        | Used on           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Product card | Link-wrapped card: square image, brand (`text-xs text-neutral-500`), truncated name, price block, stock badge. Hover raises `shadow-md` and underlines the name                                             | All listing pages |
| Product grid | `grid grid-cols-2 gap-4 sm:grid-cols-3` — **capped at three columns at every breakpoint**, deliberately, so cards keep a readable image size                                                                | All listing pages |
| Price block  | When the product has no variants **and** `discount > 0`: struck MRP + selling price + `X% off` emerald pill. Otherwise a single price, prefixed `From ` when it is a variant-derived minimum (`FR-CAT-050`) | Card, detail      |
| Stock badge  | `In stock` in neutral, `Out of stock` in red. A zero-stock product is still listed and still linkable (`FR-CAT-008`)                                                                                        | Card, detail      |
| Facet pill   | `rounded-full border px-2 py-0.5 text-xs`; active is `bg-neutral-900 text-white`. Clicking an active pill clears it                                                                                         | Filter sidebar    |
| Filter group | `text-sm font-semibold text-neutral-700` heading over a `space-y-1` option list; subcategories indent one step under their parent                                                                           | Filter sidebar    |

---

## 3. Page-by-page Wireframes

Wireframes show regions and reading order, not pixel-accurate widths — see [docs/ui/README.md](../README.md#wireframes). The header is drawn once here and omitted from the rest.

### 3.1 Catalog listing

```
┌───────────────────────────────────────────────────────────┐
│ TechCart  Audio  Wearables  Cables    [ Search…    ] ← hdr│
├───────────────────────────────────────────────────────────┤
│ All products                                              │
│                                                           │
│ ┌───────────────┐  ┌────────────────────────────────────┐ │
│ │ Category      │  │ 42 products          Sort:      ▾  │ │
│ │  ▸ Audio      │  ├────────────────────────────────────┤ │
│ │    · Headsets │  │ ┌────────┐ ┌────────┐ ┌────────┐   │ │
│ │    · Cables   │  │ │   ▢    │ │   ▢    │ │   ▢    │   │ │
│ │  ▸ Wearables  │  │ │ Acme   │ │ Orbit  │ │ Acme   │   │ │
│ │               │  │ │ Kai…   │ │ Nova…  │ │ Zen…   │   │ │
│ │ Brand         │  │ │ ₹2,499 │ │ From ₹ │ │ ₹999   │   │ │
│ │  ○ All brands │  │ │ ₹3,399 │ │  1,299 │ │        │   │ │
│ │  ○ Acme       │  │ │ 26% off│ │        │ │        │   │ │
│ │  ○ Orbit      │  │ │In stock│ │In stock│ │Out of  │   │ │
│ │               │  │ └────────┘ └────────┘ └────────┘   │ │
│ │ Price (₹)     │  │ ┌────────┐ ┌────────┐ ┌────────┐   │ │
│ │ [min ] [max ] │  │ │   …    │ │   …    │ │   …    │   │ │
│ │               │  │ └────────┘ └────────┘ └────────┘   │ │
│ │ Color         │  │                                    │ │
│ │ (Black)(White)│  │             ‹ 1  2  3 ›            │ │
│ │ Size          │  │                                    │ │
│ │ (M)(L)        │  │                                    │ │
│ │               │  │                                    │ │
│ │ Clear all     │  │                                    │ │
│ │ filters       │  │                                    │ │
│ │   lg:w-64     │  │              flex-1                │ │
│ └───────────────┘  └────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/` (catalog root). **Rendering:** ISR, per [docs/architecture.md](../../architecture.md) §4.1.
- **Regions:** header → page heading → filter aside → toolbar (result count, sort) → grid → pagination.
- **Filters:** category tree (top-level with subcategories indented), brand, price range (min/max, in ₹), and variant-attribute facet pills derived from the active variants of published products (`FR-CAT-052`). A "Clear all filters" control resets every filter and the page number together.
- **Sort:** Featured (default), Price: Low to High, Price: High to Low, Newest first (`FR-CAT-006`). "Relevance" is search-only and is not offered here.
- **Data per card:** brand, name, price block, stock badge.
- **States:** loading (skeleton grid), loaded, empty ("No products match your filters."), error ([buyer-main-ui.md §10.1](buyer-main-ui.md#101-the-four-render-states)).
- **Requirements:** `FR-CAT-001`, `005`–`009`, `040`, `052`.

### 3.2 Category

```
┌───────────────────────────────────────────────────────────┐
│ Audio / Headsets                            ← breadcrumb  │
│ Headsets                                                  │
│                                                           │
│ ┌───────────────┐  ┌────────────────────────────────────┐ │
│ │ Brand         │  │ 12 products in Headsets   Sort  ▾  │ │
│ │  ○ All brands │  ├────────────────────────────────────┤ │
│ │  ○ Acme       │  │ ┌────────┐ ┌────────┐ ┌────────┐   │ │
│ │               │  │ │   …    │ │   …    │ │   …    │   │ │
│ │ Price (₹)     │  │ └────────┘ └────────┘ └────────┘   │ │
│ │ [min ] [max ] │  │                                    │ │
│ │               │  │              ‹ 1  2 ›              │ │
│ │ Color         │  │                                    │ │
│ │ (Black)(White)│  │  no category facet — the page is   │ │
│ │               │  │  already scoped                    │ │
│ │ Clear all     │  │                                    │ │
│ │ filters       │  │                                    │ │
│ └───────────────┘  └────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- **Route:** category page by slug. **Rendering:** ISR.
- Same layout and toolbar as the catalog listing, with three differences: a breadcrumb above the heading showing the parent category when there is one; **no category facet** (the page is already scoped); and the result count names the category.
- A parent category's listing includes the products of its subcategories (`FR-CAT-002`).
- Facets are computed within the category scope; when a category has no variant attributes, the facet group shows an explicit "None for this category" rather than an empty box.
- **Extra state:** category not found — a dashed panel with a link back to the catalog root.
- **Requirements:** `FR-CAT-002`, plus everything in [§3.1](#31-catalog-listing).

**Deviation from the prototype:** `mock-ui/buyer/category.html` omits "Clear all filters" and does not highlight the default "All brands" option on first paint. Both are prototype bugs. The real category page carries the same clear-filters control as the catalog listing, and every filter group shows its active option from first render.

### 3.3 Product detail

```
┌───────────────────────────────────────────────────────────┐
│ Audio / Headsets / Kai Wireless             ← breadcrumb  │
│                                                           │
│ ┌──────────────────────┐  ┌─────────────────────────────┐ │
│ │                      │  │ Acme                        │ │
│ │                      │  │ Kai Wireless Headphones     │ │
│ │      main image      │  │ Audio › Headsets            │ │
│ │       (square)       │  │                             │ │
│ │                      │  │ ₹2,499   ₹3,399   26% off   │ │
│ │                      │  │ In stock                    │ │
│ └──────────────────────┘  │                             │ │
│ ┌────┐┌────┐┌────┐┌────┐  │ Color                       │ │
│ │ ▢  ││ ▢  ││ ▢  ││ ▢  │  │ (Black) (White) (Blue)      │ │
│ └────┘└────┘└────┘└────┘  │ Size                        │ │
│    thumbnail strip        │ (M) (L)                     │ │
│                           │                             │ │
│     md:grid-cols-2        │ Description                 │ │
│                           │ …                           │ │
│                           └─────────────────────────────┘ │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Specifications                                        │ │
│ │ ▸ Audio      Driver size   40 mm                      │ │
│ │              Impedance     32 Ω                       │ │
│ │ ▸ Battery    Playback      30 h                       │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│   no purchase control until v0.4 — see the note below     │
└───────────────────────────────────────────────────────────┘
```

- **Route:** product page by slug. **Rendering:** ISR.
- **Regions:** breadcrumb → two-column `grid grid-cols-1 gap-8 md:grid-cols-2` — gallery on the left, product information on the right.
- **Gallery:** a square main image plus a thumbnail strip. When a variant is selected and has its own images (1–2), they replace the product's; when it has none, the parent product's images are used (`FR-CAT-051`).
- **Information column:** brand link, product name (`h1`), category link, price block, stock badge, variant selector, description, then the specification table.
- **Variant selector:** one control group per attribute axis (Color, Size, …), rendered from the category's variant-type definitions when present and as plain buttons otherwise. Selecting a combination updates price, stock, and images together. Defaults to the lowest-`sellingPrice` active variant (`FR-CAT-051`). A combination with no matching active variant shows "This combination isn't available." and clears the stock badge rather than showing stale data.
- **Specifications:** all name/value pairs, grouped by the category's `specificationGroups`, with units appended where the definition supplies one (`FR-CAT-044`).
- **Read-only:** there is no "Add to cart" in v0.2. The prototype's amber note stating so is a prototype affordance — the shipped page should simply not present a purchase control until v0.4, rather than explaining its absence to buyers.
- **States:** loaded, not found (dashed panel + link back).
- **Requirements:** `FR-CAT-003`, `008`, `044`, `050`, `051`, `053`.

### 3.4 Search results

```
┌───────────────────────────────────────────────────────────┐
│ Search results                                            │
│ Showing results for "wireless headphones"                 │
│                                                           │
│ 7 products                              Sort: Relevance ▾ │
│                                                           │
│ ┌────────┐ ┌────────┐ ┌────────┐                          │
│ │   ▢    │ │   ▢    │ │   ▢    │                          │
│ │ Acme   │ │ Orbit  │ │ Acme   │   single column,         │
│ │ Kai…   │ │ Nova…  │ │ Zen…   │   no filter aside        │
│ │ ₹2,499 │ │ From ₹ │ │ ₹999   │                          │
│ │In stock│ │In stock│ │Out of  │                          │
│ └────────┘ └────────┘ └────────┘                          │
│ ┌────────┐ ┌────────┐ ┌────────┐                          │
│ │   …    │ │   …    │ │   …    │                          │
│ └────────┘ └────────┘ └────────┘                          │
│                                                           │
│                      ‹ 1  2 ›                             │
└───────────────────────────────────────────────────────────┘
```

- **Route:** search page, keyword in the `q` query parameter. **Rendering:** client-fetched (this route is not in [docs/architecture.md](../../architecture.md) §4.1's ISR set — results are query-dependent).
- Single column: heading, the echoed query, result count, sort control (with **Relevance** as the first option and the default), grid, pagination. No filter sidebar today.
- Search matches name and description, case-insensitive and partial, with fuzzy/typo-tolerant matching so close misspellings still return results (`FR-CAT-004`).
- **States:** loading, loaded, empty, error — and the empty state is **two distinct messages**: no keyword entered yet, versus no results for the keyword that was entered (`FR-CAT-010`). Do not collapse them into one string.
- **Requirements:** `FR-CAT-004`, `006`, `007`, `010`.

---

## 4. UI Behavior and Interactions

Rules specific to Product Catalog. Storefront-wide conventions — the four render states, filters/sort/pagination, escaping — are in [buyer-main-ui.md §10](buyer-main-ui.md#10-interaction-conventions); error rendering is in [§7.3](buyer-main-ui.md#73-error-messages).

### 4.1 Price display

Prices are stored as **integer paise** and rendered as `₹` plus an `en-IN`-grouped rupee figure (`FR-CAT-018`). Never render raw paise, and never do currency arithmetic in the view layer — `sellingPrice` is computed server-side (`FR-CAT-062`) and the client only formats it. There is no currency selector: the market is India-only.

### 4.2 Variant defaulting and fallback

For a product with active variants: default to the lowest-`sellingPrice` active variant; show the base product's price as a `From …` figure in listings (`FR-CAT-050`); fall back to the parent product's images when the selected variant has none (`FR-CAT-051`). Inactive variants never appear buyer-facing, and a variant of a `draft`/`archived` product never appears at all regardless of its own `active` flag (`FR-CAT-053`).

---

## 5. Requirements Traceability

Where each `FR-CAT-` requirement cited by this document is realized.

| Requirement  | Realized by                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `FR-CAT-001` | Catalog listing [§3.1](#31-catalog-listing)                                                                               |
| `FR-CAT-002` | Category [§3.2](#32-category) — parent listing includes subcategory products                                              |
| `FR-CAT-003` | Product detail [§3.3](#33-product-detail)                                                                                 |
| `FR-CAT-004` | Search results [§3.4](#34-search-results) — partial, case-insensitive, fuzzy                                              |
| `FR-CAT-005` | Price-range filter, [§3.1](#31-catalog-listing) and [§3.2](#32-category)                                                  |
| `FR-CAT-006` | Sort control on [§3.1](#31-catalog-listing), [§3.2](#32-category) and [§3.4](#34-search-results)                          |
| `FR-CAT-007` | Pagination on every listing ([buyer-main-ui.md §7.4](buyer-main-ui.md#74-component-inventory))                            |
| `FR-CAT-008` | Stock badge [§2](#2-ui-design-details) — zero-stock products stay listed and linkable                                     |
| `FR-CAT-009` | Every listing and detail page shows published products only                                                               |
| `FR-CAT-010` | Empty states — [§3.1](#31-catalog-listing), [§3.2](#32-category), and [§3.4](#34-search-results)'s two distinct messages  |
| `FR-CAT-018` | Price display [§4.1](#41-price-display) — paise storage, `en-IN` rendering                                                |
| `FR-CAT-026` | Header category nav ([buyer-main-ui.md §5.1](buyer-main-ui.md#51-header)) — active only, Decision #13                     |
| `FR-CAT-040` | Brand filter and card brand line, [§3.1](#31-catalog-listing) and [§2](#2-ui-design-details)                              |
| `FR-CAT-044` | Specifications table [§3.3](#33-product-detail) — grouped, units appended                                                 |
| `FR-CAT-050` | Price block [§2](#2-ui-design-details) — `From …` for variant-derived minimums                                            |
| `FR-CAT-051` | Variant selector and gallery fallback, [§3.3](#33-product-detail); defaulting [§4.2](#42-variant-defaulting-and-fallback) |
| `FR-CAT-052` | Variant-attribute facet pills, [§3.1](#31-catalog-listing) and [§3.2](#32-category)                                       |
| `FR-CAT-053` | Variant visibility [§4.2](#42-variant-defaulting-and-fallback) — draft/archived products never surface                    |
| `FR-CAT-062` | Price display [§4.1](#41-price-display) — selling price is server-computed                                                |
