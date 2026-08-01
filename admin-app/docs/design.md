# admin-app — design.md (shell layout + color)

This doc records the design decisions made so far for `mock-ui/admin-app/*.html`: the outer page
chrome (no top header bar — the sidebar is the only persistent chrome, carrying the admin user's
identity at its bottom) and, as of this pass, a color palette, a light type scale, and a radius
system applied across all 8 wireframes.

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

## Files this applies to

All 8 files in `mock-ui/admin-app/`: `index.html` (the abstract shell mock) plus the 7 content
pages — `product-list.html`, `product-detail.html`, `product-form.html`, `category-list.html`,
`brand-list.html`, `specification-editor.html`, `variant-type-editor.html`.

## Note for the future `admin-app/src` build-out

`admin-app/src/` has no real `Sidebar`/`Header`/`PageHeader` components yet — just `App.tsx` and a
placeholder route. When those get built, this doc's shell shape and color palette are the starting
point, not a fresh decision — including turning the Colors table above into real Tailwind `@theme`
aliases at that point. Spacing-token formalization, an icon set, and responsive/mobile behavior are
still undecided; add them here once the main content sections that drive those decisions exist.
