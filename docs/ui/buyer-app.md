# buyer-app — UI

**Project:** TechCart
**Scope:** Product Catalog (SRS v0.2) — every other feature is stubbed in §8, not designed
**Status:** Draft — design language and screens derived from the `mock-ui/buyer/` prototype, raised to a normative target for implementation
**Related:** [docs/architecture.md](../architecture.md) §4.1 (rendering strategy, client state); [docs/srs/features/0.2-product-catalog.md](../srs/features/0.2-product-catalog.md) §6 (the requirements this realizes); [docs/ui/admin-app.md](admin-app.md) (admin console); [mock-ui/buyer/](../../mock-ui/buyer/) (clickable prototype)

---

## 1. Purpose and source of truth

This document specifies **how the buyer storefront looks and behaves**. It sits in a deliberate chain, and each link owns a different question:

| Artifact                                      | Owns                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `docs/architecture.md` §4.1                   | Which rendering strategy each route uses, and which libraries   |
| `docs/srs/features/<version>-<feature>.md` §6 | **What** the UI must let a buyer do — requirements, `FR-` IDs   |
| This document                                 | **How** it looks and behaves — design language, screens, states |
| `mock-ui/buyer/`                              | A throwaway visual reference for this document                  |
| `buyer-app/src/features/`                     | The implementation                                              |

Precedence, when two of them disagree:

- Root `docs/architecture.md` wins on architecture. This document never restates or overrides a root-level decision — it only says what the pixels do.
- The feature's SRS wins on requirements. If a screen here appears to add a capability, the SRS is short a requirement and should be amended there first; do not treat this document as a way to smuggle in scope.
- **This document wins over `mock-ui/`.** The prototype is a static HTML/vanilla-JS sketch with known, deliberate simplifications (see `mock-ui/README.md`) and several outright gaps — most importantly, it has no accessibility affordances at all (§7). Where the two differ, the prototype is wrong.

Implementation-level concerns for this workspace — Tailwind wiring, TypeScript config, test setup — live in `buyer-app/docs/architecture.md` and are not repeated here.

---

## 2. Visual language

The storefront's identity is **quiet and neutral**: a near-white page, white surfaces, hairline borders, near-zero elevation, and a single near-black accent. Colour is reserved for meaning (discount, stock, error), never decoration. This is a deliberate contrast with `admin-app`'s indigo-on-slate console — see the note at the end of this section.

Everything below is expressed in Tailwind utility classes, because Tailwind 4 is the styling layer for this workspace (`buyer-app/docs/architecture.md`) and the default palette is used as-is — there is no custom colour ramp to invent.

### 2.1 Colour

| Role                        | Classes                                                                                                     | Notes                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Page background / body text | `bg-neutral-50` / `text-neutral-900`                                                                        | Set once on the root layout                                           |
| Surface                     | `bg-white` + `border border-neutral-200`                                                                    | Cards, header, any raised region                                      |
| **Primary action**          | `bg-neutral-900 text-white hover:bg-neutral-700`                                                            | Buttons, submit, and the active state of pagination and facet pills   |
| Success / discount          | `bg-emerald-100 text-emerald-700`                                                                           | The `X% off` pill only                                                |
| Danger / out of stock       | `bg-red-100 text-red-700`; error panel `border-red-200 bg-red-50 text-red-700` with `text-red-500` sub-copy | Never used for anything non-negative                                  |
| Informational note          | `bg-amber-50 text-amber-700`                                                                                | Non-blocking asides, e.g. the "Add to cart ships in v0.4" note        |
| Muted text ladder           | `text-neutral-700` → `600` → `500` → `400`                                                                  | Section heading → label → meta → placeholder/empty. Do not skip rungs |
| Divider                     | `border-neutral-200`, `border-neutral-100` inside dense lists                                               |                                                                       |

There is intentionally **no brand hue** beyond near-black. A buyer-facing accent colour is a design decision nobody has made yet; do not introduce one ad hoc.

### 2.2 Typography

No `font-family` is declared anywhere — the storefront runs on Tailwind's default `ui-sans-serif, system-ui` stack. Introducing a webfont is a decision that needs making explicitly (it has a measurable cost against the performance NFRs reserved for SRS v0.9), not a drive-by change.

| Use                                   | Classes                                            |
| ------------------------------------- | -------------------------------------------------- |
| Page heading (`h1`)                   | `text-2xl font-semibold tracking-tight`            |
| Wordmark                              | `text-xl font-semibold tracking-tight`             |
| Card price, gallery placeholder       | `text-lg font-semibold`                            |
| Struck-through MRP                    | `text-sm text-neutral-400 line-through`            |
| Body, table, controls                 | `text-sm` — the default for essentially everything |
| Helper text, badges, breadcrumb, meta | `text-xs`                                          |

Weights are limited to `font-medium` and `font-semibold`. `font-bold` is not used on the storefront.

### 2.3 Spacing, radii, elevation

- **Container** — `mx-auto max-w-6xl px-4 py-6` for listing pages; `max-w-5xl` for the product detail page.
- **Padding** — cards `p-3` (product card) or `p-5` (larger panels); controls `px-3 py-1.5` standard, `px-2 py-1` compact, `px-2 py-0.5` for pills.
- **Rhythm** — `gap-*`/`space-y-*` on the 2/3/4/6/8 steps only.
- **Radii** — `rounded-md` for controls and buttons, `rounded-lg` for cards and panels, `rounded-full` for pills, `rounded` for small inline badges.
- **Elevation** — deliberately almost none. The only shadow in the entire storefront is `hover:shadow-md` on the product card. Depth is communicated by borders, not shadows; adding a shadow scale is a design decision, not a styling detail.

### 2.4 Iconography

Inline Feather-style SVG paths, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, sized `h-5 w-5` (`h-4 w-4` when inside a control). No icon library is a dependency today. Decorative icons take `aria-hidden="true"`; an icon that is the only content of a control needs an accessible name (§7).

### 2.5 Where these live in code

Tailwind 4 is wired CSS-first — there is no `tailwind.config.js`, just `@import "tailwindcss";` in `src/app/globals.css` (see `buyer-app/docs/architecture.md`). When these values start repeating across features, promote them to an `@theme` block in that same file rather than adding a config file or a second source of truth.

### 2.6 Why this differs from `admin-app`

`admin-app` uses an indigo accent on a dark slate shell; the storefront uses near-black on near-white. This is **intentional**, not drift: the two apps have different audiences, different session lengths, and no shared component code (there is no `packages/` directory in this repo — see `docs/architecture.md` §8). Neither app's palette is the "real" one. See [docs/ui/admin-app.md](admin-app.md) §2.

---

## 3. Layout and shell

Every buyer page is: header → `<main>` container → (optionally) a two-column filter/content split.

### 3.1 Header

One shared header across all buyer routes:

- Wordmark on the left, linking to the catalog root.
- A `<nav>` of top-level categories — **only categories with `status: true`** (`FR-CAT-026`, Decision #13). An inactive category is absent from the nav, but its page remains reachable by URL.
- A search field, right-aligned, submitting to the search route. In the prototype this is a plain `GET` form that works with JavaScript disabled; preserve that property — the search box must not depend on client-side JS to navigate.
- The field repopulates from the current query so the term is still visible on the results page.

### 3.2 Main container

`mx-auto max-w-6xl px-4 py-6`, narrowing to `max-w-5xl` on the product detail page.

### 3.3 Filter/content split

Listing pages use `flex flex-col gap-6 lg:flex-row`: an `<aside class="w-full shrink-0 space-y-6 lg:w-64">` for filters, and a `<section class="flex-1">` for the toolbar, grid, and pagination. Below `lg` the filter column stacks above the grid.

### 3.4 Footer

There is none yet. A footer is not designed and should not be improvised — it needs its own content decisions (legal links, contact, policies) that no SRS version has made.

---

## 4. Component inventory

| Component           | Spec                                                                                                                                                                                                        | Used on           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Product card        | Link-wrapped card: square image, brand (`text-xs text-neutral-500`), truncated name, price block, stock badge. Hover raises `shadow-md` and underlines the name                                             | All listing pages |
| Product grid        | `grid grid-cols-2 gap-4 sm:grid-cols-3` — **capped at three columns at every breakpoint**, deliberately, so cards keep a readable image size                                                                | All listing pages |
| Price block         | When the product has no variants **and** `discount > 0`: struck MRP + selling price + `X% off` emerald pill. Otherwise a single price, prefixed `From ` when it is a variant-derived minimum (`FR-CAT-050`) | Card, detail      |
| Stock badge         | `In stock` in neutral, `Out of stock` in red. A zero-stock product is still listed and still linkable (`FR-CAT-008`)                                                                                        | Card, detail      |
| Facet pill          | `rounded-full border px-2 py-0.5 text-xs`; active is `bg-neutral-900 text-white`. Clicking an active pill clears it                                                                                         | Filter sidebar    |
| Filter group        | `text-sm font-semibold text-neutral-700` heading over a `space-y-1` option list; subcategories indent one step under their parent                                                                           | Filter sidebar    |
| Pagination          | Numbered buttons only — no prev/next, no ellipsis. Hidden entirely when there is one page. Active page is `bg-neutral-900 text-white`                                                                       | All listing pages |
| Breadcrumb          | A real `<nav>`, `/`-separated, `text-sm text-neutral-500`; the current page is plain text, not a link. Max two levels, matching the category depth limit                                                    | Category, detail  |
| Skeleton            | `animate-pulse` neutral blocks in the same grid shape as the real content, so the layout does not jump on load                                                                                              | All listing pages |
| Empty state         | Dashed-border panel, `py-16`, centred: a `text-sm font-medium text-neutral-600` message plus a `text-xs text-neutral-400` suggestion                                                                        | All listing pages |
| Error state         | Red-tinted panel in the same slot as the grid. **Non-blocking** — the header, filters, and the rest of the page stay usable                                                                                 | All listing pages |
| Text input / select | `rounded-md border border-neutral-300 px-3 py-1.5 text-sm` (`px-2 py-1` compact)                                                                                                                            | Filters, search   |

No modal, drawer, toast, tab, or accordion pattern exists on the storefront yet. If a feature needs one, it is a design decision to make deliberately — not to improvise at the call site.

---

## 5. Screens

Four screens exist today, all belonging to Product Catalog (SRS v0.2).

### 5.1 Catalog listing

- **Route:** `/` (catalog root). **Rendering:** ISR, per `docs/architecture.md` §4.1.
- **Regions:** header → page heading → filter aside → toolbar (result count, sort) → grid → pagination.
- **Filters:** category tree (top-level with subcategories indented), brand, price range (min/max, in ₹), and variant-attribute facet pills derived from the active variants of published products (`FR-CAT-052`). A "Clear all filters" control resets every filter and the page number together.
- **Sort:** Featured (default), Price: Low to High, Price: High to Low, Newest first (`FR-CAT-006`). "Relevance" is search-only and is not offered here.
- **Data per card:** brand, name, price block, stock badge.
- **States:** loading (skeleton grid), loaded, empty ("No products match your filters."), error (§6.1).
- **Requirements:** `FR-CAT-001`, `005`–`009`, `040`, `052`.

### 5.2 Category

- **Route:** category page by slug. **Rendering:** ISR.
- Same layout and toolbar as the catalog listing, with three differences: a breadcrumb above the heading showing the parent category when there is one; **no category facet** (the page is already scoped); and the result count names the category.
- A parent category's listing includes the products of its subcategories (`FR-CAT-002`).
- Facets are computed within the category scope; when a category has no variant attributes, the facet group shows an explicit "None for this category" rather than an empty box.
- **Extra state:** category not found — a dashed panel with a link back to the catalog root.
- **Requirements:** `FR-CAT-002`, plus everything in §5.1.

**Deviation from the prototype:** `mock-ui/buyer/category.html` omits "Clear all filters" and does not highlight the default "All brands" option on first paint. Both are prototype bugs. The real category page carries the same clear-filters control as the catalog listing, and every filter group shows its active option from first render.

### 5.3 Product detail

- **Route:** product page by slug. **Rendering:** ISR.
- **Regions:** breadcrumb → two-column `grid grid-cols-1 gap-8 md:grid-cols-2` — gallery on the left, product information on the right.
- **Gallery:** a square main image plus a thumbnail strip. When a variant is selected and has its own images (1–2), they replace the product's; when it has none, the parent product's images are used (`FR-CAT-051`).
- **Information column:** brand link, product name (`h1`), category link, price block, stock badge, variant selector, description, then the specification table.
- **Variant selector:** one control group per attribute axis (Color, Size, …), rendered from the category's variant-type definitions when present and as plain buttons otherwise. Selecting a combination updates price, stock, and images together. Defaults to the lowest-`sellingPrice` active variant (`FR-CAT-051`). A combination with no matching active variant shows "This combination isn't available." and clears the stock badge rather than showing stale data.
- **Specifications:** all name/value pairs, grouped by the category's `specificationGroups`, with units appended where the definition supplies one (`FR-CAT-044`).
- **Read-only:** there is no "Add to cart" in v0.2. The prototype's amber note stating so is a prototype affordance — the shipped page should simply not present a purchase control until v0.4, rather than explaining its absence to buyers.
- **States:** loaded, not found (dashed panel + link back).
- **Requirements:** `FR-CAT-003`, `008`, `044`, `050`, `051`, `053`.

### 5.4 Search results

- **Route:** search page, keyword in the `q` query parameter. **Rendering:** client-fetched (this route is not in §4.1's ISR set — results are query-dependent).
- Single column: heading, the echoed query, result count, sort control (with **Relevance** as the first option and the default), grid, pagination. No filter sidebar today.
- Search matches name and description, case-insensitive and partial, with fuzzy/typo-tolerant matching so close misspellings still return results (`FR-CAT-004`).
- **States:** loading, loaded, empty, error — and the empty state is **two distinct messages**: no keyword entered yet, versus no results for the keyword that was entered (`FR-CAT-010`). Do not collapse them into one string.
- **Requirements:** `FR-CAT-004`, `006`, `007`, `010`.

---

## 6. State and interaction conventions

### 6.1 The four render states

Every asynchronous region resolves to exactly one of: **loading**, **loaded**, **empty**, **error**. Rules:

- Loading renders a skeleton in the shape of the eventual content, never a spinner and never a collapsed container.
- Empty is a designed state with its own copy, never a zero-row grid.
- Error is scoped to the region that failed and is **non-blocking** — a failed product fetch must not take down the header, the nav, or the filters.
- The states are per-region, not per-page. A page with two independent fetches has two independent state machines.

### 6.2 Filters, sort, and pagination

- Any change to a filter or the sort order resets to page 1. Changing the page does not touch the filters.
- Changing the page scrolls the results region back into view.
- Filter state belongs in the URL so a filtered listing is linkable, shareable, and survives a reload. The prototype keeps it in memory only; that is a prototype limitation, not the target.
- Clearing filters resets the filter values, the page number, and the visible active states in one action.

### 6.3 Price display

Prices are stored as **integer paise** and rendered as `₹` plus an `en-IN`-grouped rupee figure (`FR-CAT-018`). Never render raw paise, and never do currency arithmetic in the view layer — `sellingPrice` is computed server-side (`FR-CAT-062`) and the client only formats it. There is no currency selector: the market is India-only.

### 6.4 Variant defaulting and fallback

For a product with active variants: default to the lowest-`sellingPrice` active variant; show the base product's price as a `From …` figure in listings (`FR-CAT-050`); fall back to the parent product's images when the selected variant has none (`FR-CAT-051`). Inactive variants never appear buyer-facing, and a variant of a `draft`/`archived` product never appears at all regardless of its own `active` flag (`FR-CAT-053`).

### 6.5 Escaping

All product, brand, and category names are admin-supplied text rendered on a public page. React escapes by default — do not reach for `dangerouslySetInnerHTML` to render catalog data. (The prototype interpolates unescaped strings into `innerHTML` throughout; that is safe only because its data is a hard-coded fixture.)

---

## 7. Accessibility and responsive requirements

**These are requirements for `buyer-app`, not descriptions of the prototype.** SRS v0.9 will specify system-wide frontend NFRs; until it lands, this section is the bar.

### 7.1 Accessibility

- Every interactive element has a visible focus indicator. `focus:outline-none` is only acceptable when paired with a replacement ring in the same class list.
- Icon-only controls carry an accessible name via `aria-label`. A `title` attribute is not an accessible name.
- The active nav item and the current pagination page are marked `aria-current`.
- Result counts and any region that swaps in new async content are announced — `aria-live="polite"` on the count, so filtering and searching are perceivable without sight of the grid.
- Filter facets and the variant selector are fully keyboard-operable, with selection state exposed (`aria-pressed` for toggles, or native radio/checkbox semantics — do not fake either with a `<div>`).
- Breadcrumbs are a `<nav>` with an accessible name.
- Real images carry meaningful `alt`; decorative SVG carries `aria-hidden="true"`.
- Form fields keep their `<label>` association, and invalid fields set `aria-invalid` plus `aria-describedby` pointing at the error text.
- Colour is never the only carrier of meaning — the stock badge says "Out of stock", it is not merely red.

### 7.2 Responsive

Tailwind's default breakpoints, mobile-first. Only `sm` (640px), `md` (768px), and `lg` (1024px) are in use:

| Breakpoint | Behaviour                                                                   |
| ---------- | --------------------------------------------------------------------------- |
| base       | Filters stacked above the grid; product grid two columns; PDP single column |
| `sm`       | Product grid three columns; search field sizes to content                   |
| `md`       | PDP splits into gallery + information columns                               |
| `lg`       | Filter sidebar moves beside the grid at `w-64`                              |

The grid stays at three columns above `lg` by design. If wide-viewport density becomes a real complaint, changing it is a design decision to record here, not a per-page override.

### 7.3 Where `mock-ui` falls short

Do not copy these forward:

| Gap in the prototype                                            | What `buyer-app` must do instead                          |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| Zero `aria-*` attributes anywhere in the whole prototype        | §7.1 in full                                              |
| Search input uses `focus:outline-none` with no replacement ring | Visible `focus-visible` ring on every interactive element |
| Result counts and grid swaps are silent to assistive technology | `aria-live="polite"` on the count and async regions       |
| Breadcrumbs are `<nav>` on buyer pages but decoration elsewhere | Always a `<nav>` with an accessible name                  |
| Unescaped `innerHTML` interpolation of catalog data             | Escaped rendering (§6.5)                                  |
| Filter state is in-memory only                                  | Filter state in the URL (§6.2)                            |

---

## 8. Not yet specified

No screens are designed for the features below, and none should be invented here. Each becomes a section in this document when its SRS version is written and reviewed — the SRS comes first (root `CLAUDE.md`, "Development process").

| Area                    | SRS version | Rendering already fixed by §4.1 |
| ----------------------- | ----------- | ------------------------------- |
| Home page               | —           | ISR                             |
| Sign in / register      | v0.3        | —                               |
| Cart                    | v0.4        | Client-rendered                 |
| Checkout                | v0.5 / v0.6 | Client-rendered, no caching     |
| Account / order history | v0.5        | Client-rendered, session-gated  |
| Buyer dashboard         | v0.7        | Client-rendered, session-gated  |

Two consequences worth planning around now: the header will need an account/cart affordance it does not have today, and the product detail page gains its "Add to cart" control in v0.4 (`FR-CAT-051`'s variant selection is what that control will read from).

---

## 9. Implementation notes

- **Where the code goes.** Each screen is a feature under `src/features/<feature>/`; `src/app/` stays thin routing only. This is `buyer-app`'s existing convention — see `buyer-app/AGENTS.md`.
- **Server vs client.** Catalog listing, category, and product detail render on the server (ISR) and should fetch in Server Components. The interactive parts — filter controls, sort, pagination, variant selector, search results — are Client Components. Keep the client boundary as low in the tree as it will go.
- **Data fetching.** TanStack Query for client-side fetching and caching (`docs/architecture.md` §4.1). Cart state (Zustand, `localStorage`-persisted for guests) arrives with v0.4 and is out of scope here.
- **Validation.** Any client-side validation is `buyer-app`'s own, for UX only. It is not shared with `backend` and is not what enforces correctness — see root `CLAUDE.md`, "No shared validation package."
- **Errors.** Every backend error arrives as `{ success, code, message }` (`docs/architecture.md` §6). Map `code` to user-facing copy in the UI layer; never render a raw backend `message` into an error panel.
- **Keeping this in sync.** When a screen changes, update this document in the same PR as the code. When the SRS data model changes, the order is: SRS → this document → `mock-ui/` → implementation.
