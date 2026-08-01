# admin-app — design.md (shell layout + color + data table + form nav)

This doc records the design decisions made so far for `mock-ui/admin-app/*.html`: the outer page
chrome (no top header bar — the sidebar is the only persistent chrome, carrying the admin user's
identity at its bottom), a color palette, a light type scale, and a radius system applied across
all 8 wireframes, a data-table interaction pattern applied to `product-list.html`, and — as of this
pass — a Quick Navigation panel applied to `product-form.html`.

It does **not** cover spacing tokens, icon set, or responsive/mobile behavior — none of that is
decided yet. `mock-ui/README.md`'s "no brand colours, type scale, or spacing system implied" still
holds for everything except what's recorded below. Those remaining choices are deferred to whenever
the main content sections get a deeper design pass.

## Why

Reference: an internal admin-dashboard mockup with no top app-bar — the sidebar is full-height and
carries the signed-in user's name/role at its own bottom, rather than a separate header row holding
search/notifications/avatar. Applying that shape here removes a redundant fixed bar and gives every
page's content area the full window height minus just the sidebar.

## Shell composition

**Before** (original `mock-ui/admin-app/*.html`, per `mock-ui/README.md`):

```
Side bar (full height) + Header (h-16) + Content
```

**Now:**

```
Side bar (full height, nav + bottom profile block) + Content (no header)
```

- `<aside>` is a `flex-col` with two regions: the nav list (`flex-1`, so it fills all available
  height) and a profile block pinned to the bottom by normal flex flow, separated by
  `border-t border-neutral-800` (the sidebar is a dark/inverted surface — see Colors below).
- `<main>` is now `<aside>`'s direct flex sibling — no more `<header>` stacked above it, and no
  more wrapper `<div>` around header+main since there's only one child left.
- Each page's title, breadcrumb, and primary actions (e.g. `product-list.html`'s "Products" title
  + guard note, `product-form.html`'s Save/Cancel, `specification-editor.html`'s category picker +
  "Save schema") — previously rendered inside the fixed `<header>` — now open `<main>` as its first
  block (`mb-4 flex items-center justify-between`), ahead of the existing `FR-CAT-*` annotation
  line. They're part of scrollable content now, not fixed chrome.

## Sidebar profile block

Pattern used on all 8 files:

```html
<div class="flex items-center gap-2 border-t border-neutral-800 p-3 text-sm">
  <span
    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-medium text-white"
  >
    AD
  </span>
  <div class="flex flex-col leading-tight">
    <span class="font-medium text-neutral-100">Admin User</span>
    <span class="text-xs text-neutral-400">Administrator</span>
  </div>
</div>
```

## Colors

First color/visual-identity decision made anywhere in this repo (confirmed empty before this pass:
neither app's `index.css` has a custom `@theme` block, and `buyer-app`'s mocks are equally
grayscale — that stays true for now, this section covers `admin-app` only).

| Role                 | Tailwind class          | Used for                                                            |
| --------------------- | ------------------------ | ---------------------------------------------------------------------- |
| Primary / Success      | `green-600` (hover `green-700`, badge bg `green-100`/text `green-700`) | Primary buttons, active sidebar nav item, sidebar logo tile, avatar, pagination active page, Published/Active status badges |
| Warning                | `amber-600` (badge bg `amber-100`/text `amber-700`)                    | Draft status badges, low-stock chip                                  |
| Danger                 | `red-600` (banner bg `red-50`/border `red-200`/text `red-700`)          | Guard-rejection banners, validation-error banners, "Delete" text actions |
| Neutral                | `neutral-*` (unaliased)                                                | Chrome, borders, body text, Archived/Inactive badges (`neutral-100` bg / `neutral-500` text) |
| Sidebar surface (inverted) | `neutral-900` bg, `neutral-800` borders/dividers, `neutral-300` inactive nav text, `neutral-100`/`neutral-400` profile name/role | `<aside>` only — the one deliberate dark surface in the shell |

**Technical constraint**: `mock-ui/admin-app/*.html` load Tailwind from a CDN
(`@tailwindcss/browser@4`, no build step, no shared config across the 8 files) — see
`mock-ui/README.md`. There's no mechanism for custom semantic aliases (`bg-primary`, `bg-danger`)
without a per-file `@theme` block, more machinery than 8 static wireframes need. **The mocks use
Tailwind's raw color classes directly** (`green-600`, `amber-600`, `red-600`); the table above is
the semantic *mapping*, meant as guidance for whenever `admin-app/src` gets a real Tailwind config
with aliases — it isn't wired into these files as aliases today.

## Typography

Page titles (`<h1>`) are `text-xl font-semibold tracking-tight text-neutral-900`. Everything else —
nav links, buttons, table cells, badges, form labels — stays `text-sm`/`text-xs` as before:
density-over-size, no full type scale invented beyond what's actually used on these pages.

## Radius

Sharp corners (no radius) are gone from these mocks as of this pass:

| Class          | Used for                                                          |
| -------------- | -------------------------------------------------------------------- |
| `rounded-sm`   | Small image/logo thumbnails in table cells (product image, brand logo) |
| `rounded-md`   | Inputs, filter/search boxes, small preview boxes                     |
| `rounded-lg`   | Buttons, cards/sections, table containers, alert/guard-rejection banners |
| `rounded-full` | Avatars, status/low-stock badges, pagination pills                    |

`index.html` (the abstract shell mock) only picked up the sidebar/logo/profile color treatment —
its "Content" placeholder has no page-specific content to color or round.

## Data table interaction patterns

Applied to **`product-list.html` only** — it's the one admin list that's actually paginated and
sortable in the real backend (`page`/`limit`/`sort` on `products.controller.ts`; `sort` enum is
`createdAt`/`-createdAt`/`name`/`-name`/`mrp`/`-mrp`/`stock`/`-stock`, `limit` default 20 max 100,
over-limit rejected rather than clamped) and the only one annotated "TanStack Table backs this
grid." Categories, Brands, and Variant types return full unpaginated lists today, so they stay
simple static tables — this pattern moves to them once their list endpoints are paginated.

No JavaScript is added anywhere in `mock-ui` — every affordance below is either a static visual
(matching every other non-functional control already in these files, like `Status: All ▾`) or
achieved with pure CSS:

- **Sortable headers + sort indicators**: only the columns the real API can actually sort by
  (Name, Price, Stock) get a `cursor-pointer` label + icon. The active-sort column shows a single
  bold `▲`/`▼`; sortable-but-inactive columns show a muted `↕`. Non-sortable columns (Image, SKU,
  Brand, Category, Status) get plain `<th>` text — no fake sort affordance on a column the backend
  can't sort by.
- **Column resizing**: a `cursor-col-resize` sliver (`absolute right-0 top-0 h-full w-1 border-r-2
  border-transparent hover:border-green-500`) on the right edge of every resizable `<th>`
  (`relative`-positioned). Visual only — no drag behavior without JS.
- **Sticky header**: `<thead>` gets `sticky top-0 z-10 bg-neutral-50`, inside a table wrapper with
  a bounded height (`max-h-[420px] overflow-auto`) so there's a scroll container for it to stick
  within. This one is genuinely functional — pure CSS, no JS needed.
- **Pagination + page size**: existing Prev/1/2/Next bar, plus a `Rows per page: 20 ▾` control
  matching the real default `limit=20`; a caption notes the real max (100) is enforced by
  rejection, not clamping.
- **Actions-column removal**: the old "View · Edit · Archive" text column is gone. The product
  Name cell is a real `<a href="./product-detail.html">` (replaces View — genuinely functional).
  A pencil icon appears on row hover via Tailwind's `group`/`group-hover:opacity-100` (replaces
  Edit, links to `product-form.html` — also genuinely functional, no JS). Archive/Restore moves
  into the expandable row's detail panel (see below).
- **Expandable rows**: one example row is shown already expanded (chevron rotated, a detail-panel
  `<tr>` beneath it with a couple of extra fields and the Archive button) — a demonstrated state,
  not a working toggle, following the same technique `product-detail.html` already uses to show one
  variant deactivated.
- **Inline editing**: one example row is shown mid-edit (Name/Price/Stock cells become bordered
  input-look boxes, row tinted `bg-green-50/50`, trailing cell shows Save/Cancel instead of the
  pencil) — again a demonstrated state, not working input.
- **Loading / empty / error states**: a "Listing states" section below the pagination bar, reusing
  `mock-ui/buyer-app/home.html`'s established three-column dashed-box pattern (`animate-pulse`
  skeleton bars for loading, a centered message for empty, a centered message + "Sidebar and page
  chrome stay rendered" note for error) rather than inventing a new convention.
- **Responsive layout**: unchanged from the existing `overflow-x-auto`-on-a-bounded-container
  approach (now `overflow-auto` for the added vertical scroll) — the table scrolls within its own
  container rather than reflowing, consistent with the horizontal-overflow-containment pattern
  documented in root `docs/architecture.md`.

No `FR-CAT-*` citations were added for any of this — none of these behaviors (sorting UI, resize,
sticky header, expand, inline-edit, loading/empty/error states) are in
`docs/srs/features/0.2-product-catalog.md` today. Bulk export (CSV/Excel) was considered and
dropped: it's explicitly out of scope per that SRS's §7.

## Quick Navigation panel (product-form.html)

Reference-driven: an external admin template's "Add Product" page has a left "Quick Navigation"
card listing the form's sections, with the current one highlighted, beside the section content.
Applied here using the form's *real* section names — Basics, Images, Pricing & stock,
Specifications, Variants, SEO — not the reference's own domain labels (it has "Shipping Fee", which
doesn't exist in this schema; this form has Specifications/Variants, which the reference doesn't).

The reference's apparent one-section-at-a-time swap isn't replicated — that needs JavaScript or a
multi-page restructure, neither fitting this mock-ui's no-JS, single-scrolling-page convention.
Instead, all 6 sections stay stacked exactly as before, and Quick Navigation is a sticky list of
real `<a href="#section-id">` anchor links (each section carries a matching `id` + `scroll-mt-6`) —
genuinely functional same-page navigation with zero JavaScript, the same "real where plain
HTML/CSS can do it for real" principle used for `product-list.html`'s row-name links and
hover-reveal edit icon.

**Layout**: reuses the `flex flex-col gap-6 xl:flex-row` two-panel pattern already used by
`category-list.html`, `brand-list.html`, `specification-editor.html`, and `variant-type-editor.html`
(list/editor + side panel, stacking to one column below `xl`) — not a new pattern, with one addition:
`xl:items-start` on that wrapper. Without it, the default flex `align-items: stretch` stretches the
`<nav>` to match the height of its much-taller sibling (all 6 sections stacked), so the nav's own
border/background — set directly on `<nav>`, not a wrapper — stretches the full page height instead
of staying a compact card. The nav panel is `xl:sticky xl:top-6 xl:w-64`, so once it's sized to its
own content it stays visibly pinned near the top while the (`min-w-0 flex-1`) content column scrolls
past it underneath.

**Active state**: "Basics" (the first section) shows the active highlight (`bg-green-50
font-medium text-green-700`) as a demonstrated static state — real scroll-position tracking would
need JavaScript (e.g. `IntersectionObserver`), out of scope here.

Not in scope: the reference's bottom sticky "Product completion %" bar, its restyled Upload Media
dropzone, and its top search/breadcrumb bar — none of those are part of the Quick Navigation
pattern this section covers.

## Files this applies to

All 8 files in `mock-ui/admin-app/`: `index.html` (the abstract shell mock) plus the 7 content
pages — `product-list.html`, `product-detail.html`, `product-form.html`, `category-list.html`,
`brand-list.html`, `specification-editor.html`, `variant-type-editor.html`. The data-table pattern
and the Quick Navigation panel above are each scoped to one file only, noted separately.

## Note for the future `admin-app/src` build-out

`admin-app/src/` has no real `Sidebar`/`Header`/`PageHeader` components yet — just `App.tsx` and a
placeholder route. When those get built, this doc's shell shape and color palette are the starting
point, not a fresh decision — including turning the Colors table above into real Tailwind `@theme`
aliases at that point. Spacing-token formalization, an icon set, and responsive/mobile behavior are
still undecided; add them here once the main content sections that drive those decisions exist.
