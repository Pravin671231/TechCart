# admin-app — design tokens

`mock-ui/` is deliberately grayscale — its README states it implies "no brand colours, type
scale, or spacing system," and SRS v0.2 §10 leaves screen-level visual design open (only
structural layout is resolved there). This doc is that resolution, scoped to `admin-app` only.
`buyer-app` does not use these tokens yet.

Defined in [`src/index.css`](../src/index.css) via a Tailwind v4 `@theme` block — semantic
aliases on top of Tailwind's built-in palette, not hand-rolled hex values. That keeps the
underlying color ramps (contrast steps, accessibility) as Tailwind ships them, while giving
components a semantic name (`bg-primary-600`) that stays stable if the brand color ever changes.

## Colors

| Role      | Alias                                | Underlying scale | Usage                                                                  |
| --------- | ------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Primary   | `primary` / `primary-50`…`primary-900` | Tailwind `green`  | Primary buttons, links, active nav state, focus rings                   |
| Success   | `success` / `success-50`, `-100`, `-600`, `-700` | Tailwind `green` | "Published" status badges, success toasts — same hue as primary, intentional |
| Warning   | `warning` / `warning-50`, `-100`, `-600`, `-700` | Tailwind `amber` | "Draft" status badges, low-stock flag (`FR-CAT-053`)                    |
| Danger    | `danger` / `danger-50`, `-100`, `-600`, `-700`   | Tailwind `red`    | Destructive actions, delete-guard rejections (`FR-CAT-019`, `028`)      |
| Neutral   | `neutral-*` (Tailwind default, unaliased) | Tailwind `neutral` | Muted text, "Archived" status, and chrome surfaces/borders. `MobileMenuBar`/`MainSection`/cards use the light end (`neutral-50`…`neutral-200`); `Sidebar` intentionally inverts to `neutral-900`/`neutral-800` as a dark surface — the one deliberate light/dark split in the shell, not a general dark-mode toggle |

`primary-600` is `#16A34A`. Use `primary` (not `primary-600`) in component code where possible —
it stays correct if the underlying shade is ever adjusted.

## Layout

- **Reference design viewport: 1440px.** The primary width layout decisions are made and checked
  against — a good balance for most users, per the design brief this was decided from. Not a hard
  breakpoint; the layout adapts continuously across the full range below.
- **Breakpoint scale** — five named ranges, mapped directly onto Tailwind's default breakpoints
  (`md`/`lg`/`xl` already land exactly on the Tablet/Laptop/Desktop starts; `2xl` is overridden in
  `src/index.css` from Tailwind's default 1536px to 1440px, matching Large Desktop):

  | Range         | Width           | Tailwind prefix       |
  | ------------- | --------------- | ---------------------- |
  | Mobile        | 320–767px        | *(default, unprefixed)* |
  | Tablet        | 768–1023px        | `md:`                    |
  | Laptop        | 1024–1279px         | `lg:`                     |
  | Desktop       | 1280–1439px          | `xl:`                      |
  | Large Desktop | 1440px+               | `2xl:`                      |

- **Sidebar: fixed 240px on Laptop and up** (`w-60` in `Sidebar.tsx`, `lg:static lg:translate-x-0`),
  full height, `shrink-0` — never shrinks/grows above `lg`. Below `lg` (Mobile/Tablet) it becomes an
  off-canvas drawer: `fixed inset-y-0 left-0`, hidden by default (`-translate-x-full`), slid in via
  `translate-x-0` when open. Opened by `MobileMenuBar`'s hamburger button (that bar is itself
  `lg:hidden` in full — not just visually hidden but taking no layout space — since there's nothing
  to toggle once the sidebar is always visible); closed by a semi-transparent backdrop click, an
  in-drawer close (`✕`) button, or Escape. Open/close state (`isSidebarOpen`) is lifted into
  `AdminShell.tsx`, the nearest common parent of `Sidebar` and `MobileMenuBar`, and passed down as
  props (`isOpen`/`onClose` to `Sidebar`, `onToggleSidebar` to `MobileMenuBar`).
  (`mock-ui/admin-app/index.html`'s original shell wireframe used `w-64`/256px, and
  `product-list.html` etc. used `w-56`/224px — neither was a deliberate pixel decision, just
  wireframe defaults; 240px is the real, settled value.)
- **No full-width header.** There used to be a `Header.tsx` (search, theme/fullscreen toggles,
  notifications, profile) spanning the full content-column width. It's gone — replaced by
  `MobileMenuBar.tsx` (just the hamburger button, `lg:hidden`) and the profile block, which moved
  into the bottom of `Sidebar.tsx` instead (`<nav>` is `flex-1`, pushing the profile block that
  follows it down to the sidebar's bottom edge — present in both the static column and the drawer).
  Search/theme/fullscreen/notifications were removed outright, not relocated.
- **Content area: fluid, no max-width cap.** `AdminShell.tsx`'s right column and `MainSection.tsx`
  are both `flex-1 min-w-0` — they fill whatever space remains after the sidebar (when it's in
  flow, `lg`+) or the full viewport width (when the sidebar is an overlay, below `lg`), from Mobile
  up through Large Desktop, rather than capping at a fixed width and leaving dead space on wide
  screens. `MainSection`'s padding steps down on Mobile (`p-4`, `md:p-6`) so narrow screens don't
  waste edge space.
- **`PageHeader`** stacks its title/breadcrumb above the action button on Mobile
  (`flex-col`, `sm:flex-row`) rather than forcing them onto one cramped row, and the action button
  goes full-width below `sm` for easier tapping.
- **`Dashboard`'s stat-card grid**: 1 column below `md`, 2 columns `md`–`lg`, 4 columns `lg`+ —
  matches the Tablet/Laptop breakpoint starts exactly rather than Tailwind's default `sm` (640px),
  which would switch columns mid-Mobile-range.
- **Table height at the tight end**: `DataTable`'s table container height
  (`muiTableContainerProps.maxHeight`) is `calc(100vh - 320px)` rather than a flat pixel value, so
  it doesn't overrun a 768px-tall (Tablet/minimum-desktop) viewport while still using the extra room
  at 1080px+. Horizontal overflow (many columns on a narrow viewport) is handled by `DataTable`'s
  own `overflow-x-auto` section (see "Horizontal-overflow containment" in `docs/architecture.md`)
  rather than the layout breaking.

## Icons

`react-icons`, using its `lu` (Lucide) set exclusively — `import { LuPackage } from "react-icons/lu"`.
Don't mix in another icon set; picking one keeps stroke width and visual style consistent across
`Sidebar`, `MobileMenuBar`, and every stat card.

## Radius

Tailwind's default radius scale, no new tokens — just usage rules:

| Class         | Size  | Use for                                      |
| ------------- | ----- | --------------------------------------------- |
| `rounded-md`  | 6px   | Inputs, checkboxes, small controls             |
| `rounded-lg`  | 8px   | Buttons, cards, table containers               |
| `rounded-xl`  | 12px  | Modals, panels                                 |
| `rounded-2xl` | 16px  | Shell chrome (`Sidebar`, `MobileMenuBar`)      |
| `rounded-full`| —     | Avatars, badges, pills                         |

## Spacing

Standard Tailwind 4px-based scale. Values below are the ones already in active use across
`mock-ui/admin-app/*.html` — codifying the existing wireframe spacing (the mock-ui README's
stated intent is that its utility classes get lifted straight into real components) rather than
inventing a new one:

| Class                    | Use for                                             |
| ------------------------ | ---------------------------------------------------- |
| `px-3 py-2`               | Table cell padding (dominant pattern across mocks)    |
| `px-2 py-0.5`              | Status badges, small pills                            |
| `px-3 py-1.5`              | Filter controls, compact buttons                      |
| `p-4`                      | Card padding                                          |
| `p-6`                      | Page-level content padding                            |
| `gap-2` / `gap-3` / `gap-4`| Flex layout spacing (toolbar items, filter rows)      |
| `space-y-4` / `space-y-6` | Stacked form sections                                 |
