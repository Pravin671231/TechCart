# Product Catalog — Mock UI

A static HTML/vanilla-JS reference prototype of the buyer storefront and admin
console catalog UI. No build step, no framework, no backend — it exists to plan
and visually validate page layouts and interaction flows before real
implementation, mirroring the data model in
[`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md)
(SRS v0.2, as revised 2026-07-24 — Decisions #10-17).

This is a design/planning artifact, not part of any scaffolded workspace
(`backend/`, `buyer-app/`, `admin-app/`) and not wired into the root npm
workspaces, lint, or test tooling.

## Running it

Serve the directory with any static file server and open a page — no install,
no build:

```bash
npx serve mock-ui
# or: python3 -m http.server 8080 --directory mock-ui
```

Then open `buyer/index.html` or `admin/index.html`. Opening the files directly
via `file://` also works, since everything is plain relative script tags with
no fetch/XHR calls.

## Structure

| Path      | What's there                                                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/` | `mock-data.js` (the in-memory dataset), `helpers.js` (all read/query logic over it), plus shared UI chrome — `buyer-header.js`, `product-grid.js` for the storefront and `admin-shell.js`, `admin-nav.js`, `admin-header.js`, `admin-table.js` for the console |
| `buyer/`  | Catalog listing, category, product detail, and search pages                                                                                                                                                                                                    |
| `admin/`  | Product list, product preview, the 4-step product wizard, category list (+ variant-type editor), brand list                                                                                                                                                    |

The console shell is built to [`docs/ui/admin-app.md`](../docs/ui/admin-app.md): a full-width
sticky header, a fixed sidebar beneath it generated from the SRS feature index
(only Product Catalog is enabled — the rest render disabled with their SRS
version), and `<main>` as the only scrollable region. `admin-shell.js` owns the
theme and sidebar state; both persist to `localStorage`, and the theme class is
applied by a small inline script in each page's `<head>` so it lands before
first paint.

Every page follows the same wiring: `<script src="../shared/mock-data.js">` →
`helpers.js` → any shared UI script → a page-specific script in `js/` that
reads `window.MOCK` via `window.MockHelpers` and renders into the page.

## Data model

`shared/mock-data.js` sets `window.MOCK` with the same shape as SRS v0.2's
collections: `brands`, `categories`, `categorySpecifications` (grouped),
`categoryVariants`, and `products` (with `variants` embedded per product, not
a separate collection — see the SRS's Decision #10). `shared/helpers.js`
(`window.MockHelpers`) is the only place that reads/queries `window.MOCK`
directly; page scripts should always go through it rather than touching
`window.MOCK` inline, so query logic (buyer-visible filtering, grouped spec
display, fuzzy search, price/stock roll-ups) stays in one place.

If the SRS's data model changes again, update `mock-data.js`/`helpers.js`
first, then fix whatever page scripts break — that's the intended edit order.

## Known simplifications

These are deliberate, not gaps to fix:

- **No persistence beyond page reload**, except the theme and sidebar-collapse
  preferences, which are real and survive reloads. `admin/js/categories.js` and
  `admin/js/brands.js` mutate `window.MOCK` in memory (so create/edit/delete
  actually behave), but `admin/js/product-form.js`'s wizard is fully mocked —
  step 4's save shows a banner and writes nothing back, since round-tripping a
  full product/variant edit isn't needed to validate the layout and step flow.
- **Search, filters, sort and pagination live in memory**, not the URL (the
  header search is the one exception — it submits `?q=`). The real app puts all
  of them in the URL so a filtered view is linkable.
- **No real auth.** The shared-secret admin guard (FR-CAT-030-032) isn't
  modeled; every admin page is directly reachable.
- **No real image upload.** File inputs create local `URL.createObjectURL`
  blob previews; there's no R2/presign flow. Product/brand/category images
  elsewhere are just text placeholders rendered in a gray box.
- **No pagination/search server round-trip.** Filtering, sorting, and search
  (including the fuzzy-match fallback) all run synchronously in
  `helpers.js` against the full in-memory array; buyer pages simulate a
  fetch with a `setTimeout` to show loading states.

## Keeping this in sync

This prototype was hand-updated to match the 2026-07-24 SRS revision
(embedded variants, flat `mrp`/`discount`/`sellingPrice`, category/brand
`status`, grouped `categorySpecifications`, `categoryVariants`, the admin
product detail view, buyer fuzzy search). It will drift from the SRS the next
time that doc changes — there's no automated check tying the two together, so
treat `docs/srs/features/0.2-product-catalog.md` §5 as the source of truth
and update this prototype to match, not the other way around.

This prototype is also the visual reference behind
[`docs/ui/buyer-app.md`](../docs/ui/buyer-app.md) and
[`docs/ui/admin-app.md`](../docs/ui/admin-app.md), which specify the design
language and screens for the real apps. Those documents deliberately set a
higher bar than what's here — accessibility, the admin mobile drawer, and a
handful of other gaps are called out in them as prototype shortfalls. When
they and this prototype disagree, the documents win.
