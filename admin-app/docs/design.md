# admin-app — design.md (shell layout)

This doc records one design decision so far: the outer page chrome (`mock-ui/admin-app/*.html`)
has no top header bar — the sidebar is the only persistent chrome, and it carries the admin
user's identity at its bottom.

It does **not** cover color palette, typography scale, spacing tokens, icon set, or responsive/
mobile behavior — none of that is decided yet. `mock-ui/README.md`'s "no brand colours, type
scale, or spacing system implied" still holds for everything except the shell shape described
here. Those choices are deferred to whenever the main content sections (tables, forms) get their
own design pass.

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
  `border-t border-neutral-400`.
- `<main>` is now `<aside>`'s direct flex sibling — no more `<header>` stacked above it, and no
  more wrapper `<div>` around header+main since there's only one child left.
- Each page's title, breadcrumb, and primary actions (e.g. `product-list.html`'s "Products" title
  + guard note, `product-form.html`'s Save/Cancel, `specification-editor.html`'s category picker +
  "Save schema") — previously rendered inside the fixed `<header>` — now open `<main>` as its first
  block (`mb-4 flex items-center justify-between`), ahead of the existing `FR-CAT-*` annotation
  line. They're part of scrollable content now, not fixed chrome.

## Sidebar profile block

Placeholder pattern used on all 8 files (grayscale, matching the rest of these wireframes — no
brand color or real avatar):

```html
<div class="flex items-center gap-2 border-t border-neutral-400 p-3 text-sm">
  <span
    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-400 bg-white text-xs"
  >
    AD
  </span>
  <div class="flex flex-col leading-tight">
    <span class="font-medium">Admin User</span>
    <span class="text-xs text-neutral-500">Administrator</span>
  </div>
</div>
```

## Files this applies to

All 8 files in `mock-ui/admin-app/`: `index.html` (the abstract shell mock) plus the 7 content
pages — `product-list.html`, `product-detail.html`, `product-form.html`, `category-list.html`,
`brand-list.html`, `specification-editor.html`, `variant-type-editor.html`.

## Note for the future `admin-app/src` build-out

`admin-app/src/` has no real `Sidebar`/`Header`/`PageHeader` components yet — just `App.tsx` and a
placeholder route. When those get built, this doc's shell shape is the starting point, not a fresh
decision. Color/typography/spacing tokens should be added to this doc (or a sibling doc) at that
point, once the main content sections that drive those decisions actually exist.
