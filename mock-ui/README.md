# mock-ui

Static layout wireframes for the two TechCart frontends, plus a brand kit and a few interactive
component mocks.

## Brand kit

[`brand-kit.html`](brand-kit.html) — colors (primary/accent scales + status conventions), type
scale, buttons, badges, price display, form and alert styling. Unlike most pages here, it is
deliberately **not** grayscale — see "What these are — and are not" below for why the rest stay
that way. The tokens it shows are wired for real in `buyer-app/src/app/globals.css` and
`admin-app/src/index.css`; treat those files as authoritative if this page ever drifts from them.

## Component mocks

Isolated, styled, interactive versions of individual UI components — not full screens. Each has
real `<input>`/`<select>` fields wired via inline vanilla JS (no build step, no backend calls) so
editing a field live-updates the rendered preview next to it. These **supplement, not replace**,
the full-screen catalog mocks below — the SRS traceability table still points at the full
screens, since these component pages re-render the same fields for a narrower purpose (reviewing
the component in isolation).

| File                                                               | Component                      | Data fields                                                                                                                           |
| ------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`admin-app/table-component.html`](admin-app/table-component.html) | Admin product table            | Image, name, SKU, brand, category, MRP/discount, stock, low-stock threshold, status                                                   |
| [`buyer-app/card-components.html`](buyer-app/card-components.html) | Home Card + Category-wise Card | Image, title, MRP/discount, stock (Home Card); + category and up to 4 detail pairs, in a dedicated price section (Category-wise Card) |

Price fields compute `sellingPrice` the same way as `backend/src/utils/pricing.ts`'s
`computeSellingPrice` (`mrp - floor(mrp × discount / 100)`), so the live preview matches real
backend behavior rather than inventing its own rounding.

## Shell layouts

The outer page chrome each app's real routes mount inside. Both shells are fully styled with
brand-kit tokens — see "What these are — and are not" below. `admin-app`'s shell has no header
band; the sidebar (logo/brand, nav, user profile + logout) and the content area are the whole
layout.

| File                                           | Layout                             |
| ---------------------------------------------- | ---------------------------------- |
| [`admin-app/index.html`](admin-app/index.html) | Side bar (full height) + Content   |
| [`buyer-app/index.html`](buyer-app/index.html) | Header (sticky) + Content + Footer |

## Catalog screens — SRS v0.2

Every screen [`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md)
§6 defines, built inside the shells above. Each page carries an annotation strip naming the
`FR-CAT-*` requirements it renders, so a mock can be read against the SRS line by line.

**`buyer-app`**

| File                                                             | Screen              | Key requirements                                      |
| ---------------------------------------------------------------- | ------------------- | ----------------------------------------------------- |
| [`buyer-app/home.html`](buyer-app/home.html)                     | Home / all-products | `FR-CAT-054`, `057–059`, `075`, `091`                 |
| [`buyer-app/category.html`](buyer-app/category.html)             | Category listing    | `FR-CAT-055`, `068`, `069`, `070`–`074`, `076`, `092` |
| [`buyer-app/search.html`](buyer-app/search.html)                 | Search results      | `FR-CAT-065`, `067`, `075`                            |
| [`buyer-app/product-detail.html`](buyer-app/product-detail.html) | Product detail      | `FR-CAT-056`, `059`, `063`, `064`, `084`              |

**`admin-app`**

| File                                                                         | Screen                     | Key requirements                              |
| ---------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| [`admin-app/product-list.html`](admin-app/product-list.html)                 | Product list               | `FR-CAT-005`, `008`, `011`, `050`, `053`      |
| [`admin-app/product-detail.html`](admin-app/product-detail.html)             | Product detail (read-only) | `FR-CAT-006`, `013`, `043`, `045`             |
| [`admin-app/product-form.html`](admin-app/product-form.html)                 | Product create / edit      | `FR-CAT-001`–`004`, `033`, `038`, `083`–`087` |
| [`admin-app/category-list.html`](admin-app/category-list.html)               | Categories list + form     | `FR-CAT-014`–`022`, `048`, `051`              |
| [`admin-app/brand-list.html`](admin-app/brand-list.html)                     | Brands list + form         | `FR-CAT-023`–`028`, `048`, `052`              |
| [`admin-app/specification-editor.html`](admin-app/specification-editor.html) | Spec schema editor         | `FR-CAT-030`, `031`, `035`, `092`             |
| [`admin-app/variant-type-editor.html`](admin-app/variant-type-editor.html)   | Variant-axis editor        | `FR-CAT-036`–`038`                            |

Non-happy-path states the SRS calls for are mocked alongside the happy path rather than skipped:
skeleton / empty / error listing states on `home.html`, the two distinct empty states on
`search.html`, and the guard rejections (`FR-CAT-019`, `028`, `031`, `041`) shown inline on the
admin pages that raise them.

## Traceability to SRS v0.2 §6

Every bullet in [`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md)
§6 (UI/UX Requirements) maps to exactly one mock-ui file:

| SRS v0.2 §6 requirement           | Key states covered                                             | mock-ui file                                                                 |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Home / catalog listing            | grid, sort, pagination, skeleton, empty, error                 | [`buyer-app/home.html`](buyer-app/home.html)                                 |
| Category page                     | breadcrumb, pre-filtered grid, four-spec cards                 | [`buyer-app/category.html`](buyer-app/category.html)                         |
| Search results                    | keyword shown, relevance sort, search-empty vs filter-empty    | [`buyer-app/search.html`](buyer-app/search.html)                             |
| Product detail (buyer)            | gallery, variant selector, grouped specs, availability badge   | [`buyer-app/product-detail.html`](buyer-app/product-detail.html)             |
| Product list (admin)              | all statuses, keyword/status/low-stock filters, pagination     | [`admin-app/product-list.html`](admin-app/product-list.html)                 |
| Product detail (admin, read-only) | every field at any status                                      | [`admin-app/product-detail.html`](admin-app/product-detail.html)             |
| Product create/edit form          | image widget, spec inputs, variant editor                      | [`admin-app/product-form.html`](admin-app/product-form.html)                 |
| Category list and form            | tree, product counts, delete guard inline                      | [`admin-app/category-list.html`](admin-app/category-list.html)               |
| Brand list and form               | logo, product counts, delete guard inline                      | [`admin-app/brand-list.html`](admin-app/brand-list.html)                     |
| Category specification editor     | groups/fields, reorder, filterable's two effects, card preview | [`admin-app/specification-editor.html`](admin-app/specification-editor.html) |
| Category variant-type editor      | axes, per-type control preview                                 | [`admin-app/variant-type-editor.html`](admin-app/variant-type-editor.html)   |

Per-screen `FR-CAT-*` IDs are already annotated inline on each page (and summarized in the tables
above); this table exists to answer the coarser question — "does every §6 requirement have a mock
at all" — at a glance, per [SRS v0.2 §10](../docs/srs/features/0.2-product-catalog.md#10-open-questions).

## Requirements with no visual surface

Not every `FR-CAT-*` requirement has something to draw. These 14 are intentionally never cited
in any mock, so a coverage check doesn't mistake the gap for an oversight:

| Requirement(s)      | Why there's no mock                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FR-CAT-042`        | Variant price/stock validation mirrors the product's own rules — a server-side rule, not a distinct screen                                                                      |
| `FR-CAT-060`        | A negative/absence requirement (draft/archived never returned to buyers) — nothing positive to draw either way                                                                  |
| `FR-CAT-079`, `082` | Presigned object-key format and registration validation — internal to the upload flow, invisible at any UI layer                                                                |
| `FR-CAT-089`, `090` | The 401-rejection mechanics and the guard's swappability — backend middleware behaviour                                                                                         |
| `FR-CAT-093`, `094` | The `{ success, data, pagination }` response envelope shape — an API contract, not a rendered element                                                                           |
| `FR-CAT-095`, `096` | Buyer field-visibility and `availability` derivation are server-side projection rules; their _effect_ (an availability badge) is mocked, but the rule itself isn't a UI element |
| `FR-CAT-097`–`100`  | The direct-upload backend path — same upload widget as the presigned path in `product-form.html`, no distinct UI                                                                |

## What these are — and are not

**All 15 screens plus both shells are fully styled.** Every `buyer-app` and `admin-app` file
uses the real design system from [`brand-kit.html`](brand-kit.html) — the same tokens and
component vocabulary (buttons, badges, price displays, form inputs, status colours) also used in
the two "Component mocks" files. Structure and information hierarchy are unchanged from the
original grayscale wireframes; only the visual treatment changed, screen by screen, across two
sessions (`buyer-app` first, `admin-app` after). Where the SRS specifies UI _behaviour_, these
mocks still show _where that behaviour lives on the page_ — styling never redefines what a
screen contains.

The distinction that still holds is **screen vs. isolated component**, not grayscale vs. styled:
`brand-kit.html` and the two "Component mocks" files show individual tokens/controls out of
context for quick reference, while every other file is a full screen assembled from that same
vocabulary.

Screen-level design was undecided when the SRS was first drafted; these pages are what
[SRS v0.2 §10](../docs/srs/features/0.2-product-catalog.md#10-open-questions) now records as the
resolution to that question. They are not themselves normative — the SRS remains the source of
truth for what the UI must do. Placeholder content (product names, SKUs, prices, specification
fields) is illustrative only.

## Viewing them

Open any `.html` directly in a browser — `file://` works, no server needed. Start at
[`index.html`](index.html), which links every page. Or:

```bash
npx serve mock-ui
```

**An internet connection is required.** Tailwind is loaded from a CDN
(`@tailwindcss/browser@4`, matching the `tailwindcss@4` the real workspaces use). Offline, the
pages fall back to unstyled HTML.

Utility classes here are deliberately the same ones the real apps use, so they can be lifted
straight into `buyer-app`/`admin-app` components later.

## Relationship to the workspaces

These files are **not part of any npm workspace**. They are not built, linted, tested, or
deployed, and nothing in `backend/`, `buyer-app/`, or `admin-app/` imports them. They contain no
standalone `.js` files, so the root `eslint .` run — the CI `lint` job — does not touch them.
