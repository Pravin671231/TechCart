# admin-app — design tokens (implementation notes)

**Source of truth for the design system is [`design.md`](design.md)** — colors, typography,
radius, borders, spacing, breakpoints, and layout behavior across screen sizes all live there. This
doc is the remainder: admin-app-specific implementation detail that doesn't belong in the design
system itself.

Tokens are defined in [`src/index.css`](../src/index.css) via a Tailwind v4 `@theme` block —
semantic aliases on top of Tailwind's built-in palette (see `design.md` § Colors for the full role
table and resolved values), not hand-rolled hex values. That keeps the underlying color ramps
(contrast steps, accessibility) as Tailwind ships them, while giving components a semantic name
(`bg-primary`) that stays stable if the brand color ever changes.

## Sidebar width and shell history

`Sidebar.tsx` fixes the sidebar at **240px** (`w-60`, `lg:static lg:translate-x-0`) on Laptop and
up, full height, `shrink-0`. Below `lg` it's an off-canvas drawer: `fixed inset-y-0 left-0`, hidden
by default (`-translate-x-full`), slid in via `translate-x-0`. Opened by `MobileMenuBar`'s hamburger
button; closed by a semi-transparent backdrop click, an in-drawer close (`✕`) button, or Escape.
Open/close state (`isSidebarOpen`) is lifted into `AdminShell.tsx`, the nearest common parent of
`Sidebar` and `MobileMenuBar`.

(`mock-ui/admin-app/index.html`'s original shell wireframe used `w-64`/256px, and
`product-list.html` etc. used `w-56`/224px — neither was a deliberate pixel decision, just wireframe
defaults; **240px is the real, settled value**.)

**No full-width header.** There used to be a `Header.tsx` (search, theme/fullscreen toggles,
notifications, profile) spanning the full content-column width. It's gone — replaced by
`MobileMenuBar.tsx` (just the hamburger button, `lg:hidden` in full, taking no layout space above
`lg`) and the profile block, which moved into the bottom of `Sidebar.tsx` instead (`<nav>` is
`flex-1`, pushing the profile block that follows it down to the sidebar's bottom edge — present in
both the static column and the drawer). Search/theme/fullscreen/notifications were removed
outright, not relocated.

## Table height at the tight end

`DataTable`'s table container height (`muiTableContainerProps.maxHeight`) is
`calc(100vh - 320px)` rather than a flat pixel value, so it doesn't overrun a 768px-tall
(Tablet/minimum-desktop) viewport while still using the extra room at 1080px+. Horizontal overflow
(many columns on a narrow viewport) is handled by `DataTable`'s own `overflow-x-auto` section (see
"Horizontal-overflow containment" in `docs/architecture.md`) rather than the layout breaking.

## MUI stays scoped to `DataTable.tsx`

MUI (`@mui/material`, pulled in as a `material-react-table` peer dependency) is themed via
`src/components/muiTheme.ts` to match the tokens in `design.md`, and that `<ThemeProvider>` wraps
**only** `DataTable.tsx` — no `CssBaseline`, nothing app-wide — so it can't collide with the
Tailwind styling used everywhere else in this app. Don't reach for MUI components outside
`DataTable.tsx`.
