# admin-app — design system

This is the design guideline for `admin-app`: color palette, typography, radius, borders, spacing,
responsive breakpoints, and layout behavior across screen sizes. It supersedes
[`design-tokens.md`](design-tokens.md), which is now implementation notes only (how the
tokens below are wired into `Sidebar`/`MobileMenuBar`/`DataTable` specifically).

`buyer-app` has its own separate [`buyer-app/docs/design.md`](../../buyer-app/docs/design.md) — the two apps
share no token file. Where a value below matches the storefront's, that's convergent (same brand),
not a shared import.

`mock-ui/admin-app/*.html` is structural wireframes only — its README states it implies "no brand
colours, type scale, or spacing system." This doc is that resolution for `admin-app`.

## Principles

- **Tailwind CSS 4, CSS-first.** No `tailwind.config.js`. All tokens live in a single `@theme` block
  in [`../src/index.css`](../src/index.css).
- **Tokens are semantic aliases over Tailwind's built-in ramps**, never hand-rolled hex — this keeps
  Tailwind's contrast steps and accessibility work intact while giving components a stable name
  (`bg-primary`) that survives a brand-color change.
- Prefer the roleless alias (`bg-primary`, `text-danger`) over the numbered step (`bg-primary-600`)
  in component code wherever the design doesn't need a specific step.
- **Borders over shadows.** There is no elevation/shadow system. Surfaces are separated by a 1px
  hairline border, not a box-shadow — `DataTable`'s `muiTablePaperProps` explicitly forces
  `elevation: 0, boxShadow: "none"` to enforce this even inside MUI.
- **Density over size.** This is a data-heavy console — the UI default text size is `text-sm`
  (14px), not `text-base`. Compare to `buyer-app`, whose default is `text-base` for readability.

## Colors

| Role    | Alias                                            | Underlying scale  | Usage                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary | `primary` / `primary-50`…`primary-900`             | Tailwind `green`   | Primary buttons, links, active nav state, focus rings                                                                                                                                                                                                                                   |
| Success | `success` / `success-50`, `-100`, `-600`, `-700`   | Tailwind `green`   | "Published" status badges, success toasts — same hue as primary, intentional                                                                                                                                                                                                            |
| Warning | `warning` / `warning-50`, `-100`, `-600`, `-700`   | Tailwind `amber`   | "Draft" status badges, low-stock flag (`FR-CAT-053`)                                                                                                                                                                                                                                    |
| Danger  | `danger` / `danger-50`, `-100`, `-600`, `-700`     | Tailwind `red`     | Destructive actions, delete-guard rejections (`FR-CAT-019`, `028`)                                                                                                                                                                                                                      |
| Neutral | `neutral-*` (Tailwind default, **unaliased**)      | Tailwind `neutral` | Muted text, "Archived" status, chrome surfaces/borders. Light surfaces (`MobileMenuBar`, `MainSection`, cards) use the light end (`neutral-50`…`neutral-200`); `Sidebar` intentionally inverts to `neutral-900`/`neutral-800` as a dark surface — the one deliberate light/dark split in the shell, not a general dark-mode toggle |

**Resolved values** — Tailwind v4.3.3 ships **oklch**, not hex:

| Token                                          | Underlying | Value                             |
| ----------------------------------------------- | ----------- | ---------------------------------- |
| `primary-50` / `success-50`                     | green-50    | `oklch(98.2% 0.018 155.826)`       |
| `primary-100` / `success-100`                   | green-100   | `oklch(96.2% 0.044 156.743)`       |
| `primary-600` / `primary` / `success-600`       | green-600   | `oklch(62.7% 0.194 149.214)` ≈ **#00A63E** |
| `primary-700` / `primary-hover` / `success-700` | green-700   | `oklch(52.7% 0.154 150.069)` ≈ #008236 |
| `warning-600` / `warning`                       | amber-600   | `oklch(66.6% 0.179 58.318)` ≈ #E17100 |
| `danger-600` / `danger`                         | red-600     | `oklch(57.7% 0.245 27.325)` ≈ #E7000B |

> ⚠️ **Known drift:** [`muiTheme.ts`](../src/components/muiTheme.ts) hardcodes `primary.main: "#16A34A"`
> — that's Tailwind **v3's** green-600, not v4's `#00A63E`. Fix when `muiTheme.ts` is next touched;
> not fixed in this pass so as not to bundle a visual change with a docs change.

**Surface / text / border roles**, codifying what the shell already does:

| Role                    | Class            | Where                                            |
| ------------------------ | ---------------- | ------------------------------------------------- |
| Page canvas              | `bg-neutral-100` | `AdminShell` outer wrapper                        |
| Panel / card             | `bg-white`       | `MobileMenuBar`, `Dashboard` stat cards           |
| Content surface          | `bg-neutral-50`  | `MainSection`                                     |
| Hairline border          | `border-neutral-200` | `MobileMenuBar`, cards, `DataTable` section   |
| Primary text             | `text-neutral-800` | Headings, body                                  |
| Muted text               | `text-neutral-500` | Subtitles, breadcrumbs, labels                  |
| Disabled / placeholder   | `text-neutral-400` | Input placeholders, null-value dashes            |
| Sidebar surface (inverted) | `bg-neutral-900` | `Sidebar`                                       |
| Sidebar border/divider   | `border-neutral-800` | Submenu rule, profile-block divider            |
| Sidebar body text        | `text-neutral-300` | Inactive nav links                              |
| Sidebar secondary text   | `text-neutral-400` | Role label under the admin name                 |

Every documented text-on-surface pair must clear **WCAG AA 4.5:1** (3:1 for ≥18.66px bold text).

## Typography

**Family:** [Inter](https://fonts.google.com/specimen/Inter), documented here as the chosen
typeface — **not yet wired into `src/index.css`**; both apps currently render on Tailwind's default
`--font-sans` stack (system UI fonts). Intended path: `@fontsource-variable/inter` (self-hosted, one
variable-font file covers every weight below, no Google Fonts request or layout shift), imported in
`main.tsx` and exposed as `--font-sans` in the `@theme` block, with `muiTheme.ts` set to
`typography: { fontFamily: "inherit" }` so Material React Table stops rendering its default Roboto.
Wire this as a follow-up implementation task. `--font-mono` stays Tailwind's default stack (already
used by `ProductsPage`'s SKU cell, `font-mono text-xs`).

**Type scale** — Tailwind's default scale, each step given a semantic role so pages stop
re-deriving the same classes:

| Role                | Class      | Size            | Line-height      | Weight / tracking                       |
| -------------------- | ---------- | ---------------- | ------------------ | ----------------------------------------- |
| Page title (h1)      | `text-2xl` | 1.5rem / 24px    | 2rem / 32px        | `font-semibold` `tracking-tight`          |
| Section title (h2)   | `text-xl`  | 1.25rem / 20px   | 1.75rem / 28px      | `font-semibold` `tracking-tight`          |
| Subsection (h3)      | `text-lg`  | 1.125rem / 18px  | 1.75rem / 28px      | `font-semibold`                           |
| Body                 | `text-base`| 1rem / 16px      | 1.5rem / 24px       | `font-normal`                             |
| **UI default**       | `text-sm`  | 0.875rem / 14px  | 1.25rem / 20px      | `font-normal` / `font-medium`             |
| Caption / badge      | `text-xs`  | 0.75rem / 12px   | 1rem / 16px         | `font-medium`                             |
| Overline             | `text-xs`  | 0.75rem / 12px   | 1rem / 16px         | `font-medium` `tracking-wider` uppercase  |

`text-sm` is this app's UI default — nav links, buttons, table cells, form controls all use it.
`text-base` exists in the scale but has no current console use; reserve it for dense body copy if a
future feature needs it (e.g. a long-form settings description).

**Weights:** 400 body · 500 interactive/labels (nav links, "MAIN" section label) · 600 headings,
wordmark, stat values, avatar initials · 700 reserved for the sidebar logo tile ("T") only — the
one current `font-bold` use; don't extend it elsewhere without reason.

**Tracking:** `tracking-tight` (-0.025em) on `text-lg`+ headings and the wordmark only;
`tracking-wider` (0.05em) on the uppercase "MAIN" overline; normal everywhere else. Never tighten
body text.

**Responsive type:** the scale is fixed, not fluid — console typography does not `clamp()` or step
down by breakpoint. What changes across breakpoints is layout density (padding, column count), not
font size, matching the "density over size" principle above.

## Radius

Tailwind's default radius scale, no new tokens — usage rules only:

| Class         | Size  | Use for                            |
| ------------- | ----- | ------------------------------------ |
| `rounded-sm`  | 4px   | Small placeholders (e.g. `BrandsPage` logo swatch) — the one radius step used but previously undocumented |
| `rounded-md`  | 6px   | Inputs, checkboxes, small controls   |
| `rounded-lg`  | 8px   | Buttons, cards, table containers     |
| `rounded-xl`  | 12px  | Modals, panels                       |
| `rounded-2xl` | 16px  | Shell chrome (`Sidebar`, `MobileMenuBar`) |
| `rounded-full`| —     | Avatars, badges, pills                |

Radius scales with the size of the surface it's applied to: small controls get the smallest radius,
shell-level chrome gets the largest.

## Borders

- Default is a **1px hairline** (`border`), not a shadow — see Principles above.
- Light surfaces: `border-neutral-200`. Inverted sidebar: `border-neutral-800`.
- Dividers inside a group use a single side, never a full box: `border-l` on the sidebar submenu
  (`ml-4 border-l border-neutral-800 pl-3`), `border-t` above the sidebar profile block.
- No border thicker than 1px except focus rings: `focus-visible:ring-2 ring-primary
  ring-offset-2`. Never remove an outline without a replacement.

## Spacing

Standard Tailwind 4px-based scale, codifying values already in active use:

| Class                        | Use for                                        |
| ----------------------------- | ------------------------------------------------ |
| `px-3 py-2`                    | Table cell padding (dominant pattern)            |
| `px-2 py-0.5`                   | Status badges, small pills                       |
| `px-3 py-1.5`                   | Filter controls, compact buttons                 |
| `p-4`                            | Card padding                                     |
| `p-6`                            | Page-level content padding (Desktop+, via `md:p-6`) |
| `gap-2`                           | Shell gutters (`AdminShell`'s Sidebar/MobileMenuBar/MainSection spacing) |
| `gap-3` / `gap-4`                  | Toolbar items, filter rows, intra-card spacing  |
| `gap-6`                             | Between page sections (`Dashboard`'s grid gap) |
| `mb-6`                                | Below `PageHeader`                            |
| `space-y-4` / `space-y-6`               | Stacked form sections                        |

**Minimum interactive target:** 36×36px (`h-9 w-9` — the `MobileMenuBar` hamburger) or 40px
(`h-10` — `PageHeader`'s primary action button). Both fall short of the 44px touch-target
guideline; the mitigation is that `PageHeader`'s action button goes full-width below `sm`, making
the miss-tap radius a non-issue in practice.

## Responsive breakpoints

**Reference design viewport: 1440px** — the width layout decisions are checked against. Not a hard
breakpoint; layout adapts continuously across the full range below it.

| Range         | Width         | Tailwind prefix          |
| ------------- | ------------- | -------------------------- |
| Mobile        | 320–767px      | *(default, unprefixed)*    |
| Tablet        | 768–1023px      | `md:`                      |
| Laptop        | 1024–1279px      | `lg:`                      |
| Desktop       | 1280–1439px       | `xl:`                      |
| Large Desktop | 1440px+            | `2xl:`                     |

`--breakpoint-2xl` is overridden from Tailwind's default 1536px to **1440px** (`90rem`) in
`src/index.css`, so `2xl:` lands exactly on Large Desktop.

> ⚠️ **Known drift:** `PageHeader.tsx` uses bare `sm:` (640px), which falls **mid-Mobile-range** in
> the scale above rather than on a named boundary. Left as-is for this pass — migrate when
> `PageHeader` is next touched. `xl:`/`2xl:` are declared in the scale but used nowhere in the
> codebase yet; that's expected until a screen actually needs a Desktop/Large-Desktop-specific
> change beyond the fluid content area.

## Layout behavior across screen sizes

| Element         | Mobile (< 768px)                          | Tablet (768–1023px) | Laptop (1024–1279px)         | Desktop / Large Desktop (1280px+)     |
| ---------------- | -------------------------------------------- | ---------------------- | -------------------------------- | ---------------------------------------- |
| `Sidebar`         | Off-canvas drawer, `-translate-x-full` hidden by default | same as Mobile         | **Static, fixed 240px** (`w-60`), full height, `shrink-0` | same as Laptop |
| `MobileMenuBar`   | Visible, `h-16`, hamburger opens the drawer | same as Mobile         | **`lg:hidden` — gone entirely**  | gone |
| `MainSection` padding | `p-4` (16px)                            | `p-6` (24px, via `md:p-6`) | same as Tablet                | same as Tablet |
| `Dashboard` stat grid | 1 column                                | 2 columns (`md:grid-cols-2`) | 4 columns (`lg:grid-cols-4`) | same as Laptop |
| `DataTable` height | `calc(100vh - 320px)` at all sizes — viewport-relative so it never overruns a 768px-tall viewport, while using extra room at 1080px+ | | | |

**Sidebar mechanics:** below `lg`, off-canvas drawer — `fixed inset-y-0 left-0`, hidden by
`-translate-x-full`, slid in via `translate-x-0`. Opened by `MobileMenuBar`'s hamburger, closed by a
semi-transparent backdrop click, an in-drawer `✕`, or Escape. `isSidebarOpen` is lifted into
`AdminShell.tsx`, the nearest common parent of `Sidebar` and `MobileMenuBar`.
(`mock-ui/admin-app/index.html`'s original wireframe used `w-64`/256px, `product-list.html` used
`w-56`/224px — neither was a deliberate pixel decision; **240px is the real, settled value**.)

**Content area:** fluid, no max-width cap. `AdminShell`'s right column and `MainSection` are both
`flex-1 min-w-0` — they fill whatever space remains after the sidebar, from Mobile through Large
Desktop, rather than capping width and leaving dead space on wide screens.

**Overflow-containment chain (layout invariant):** a wide table's content would otherwise propagate
width up through `MainSection`'s `<main>` and `AdminShell`'s right column, growing the page past the
viewport and pushing the fixed-width `Sidebar` out of view below `lg`. Fixed by `min-w-0` at every
link in the chain — `AdminShell` right column → `MainSection` `<main>` → `DataTable`'s
`<section data-testid="data-table-section">`, which alone carries `overflow-x-auto` and is "the one
place a horizontal scrollbar is allowed to appear." Removing `min-w-0` from any point in that chain
reintroduces the bug. See `docs/architecture.md` "Horizontal-overflow containment."

**Profile block:** moved to the bottom of `Sidebar` (avatar + name/role) above a `border-t
border-neutral-800 pt-4` divider; `<nav>` is `flex-1`, pushing it there regardless of nav-item count.

## Icons

`react-icons`, using its `lu` (Lucide) set exclusively — `import { LuPackage } from "react-icons/lu"`.
Don't mix in another icon set; one set keeps stroke width and visual style consistent.

| Size          | Class      | Use for                              |
| -------------- | ---------- | --------------------------------------- |
| 14px           | `h-3.5 w-3.5` | Breadcrumb chevrons                  |
| 16px           | `h-4 w-4`     | Inline/nav icons, buttons             |
| 20px           | `h-5 w-5`     | Standalone icon buttons (hamburger, close) |

## Motion

`transition-colors duration-200` for hover/active state changes; `transition-transform duration-200`
for the sidebar drawer slide and the product-catalog chevron rotation. Honor
`prefers-reduced-motion` — none of these are essential to comprehension.

## Where tokens live

| Layer                                   | Role                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `admin-app/docs/design.md` (this doc)     | The rules — colors, type, radius, borders, spacing, breakpoints, layout |
| `src/index.css` `@theme` block            | The values — color aliases, `--breakpoint-2xl` are wired; `--font-sans` (Inter) is **documented but not yet added** |
| `docs/design-tokens.md`                   | Admin-specific implementation notes only (MUI scoping, sidebar px history, table-height rationale) |
| `src/components/muiTheme.ts`              | The one non-Tailwind surface — MUI theme matched to these tokens, scoped to `DataTable.tsx` only |

**Known drift** (not fixed in this pass — flagged for the next time each file is touched):
Inter isn't wired yet, so both apps still render on the system font stack and MUI still falls back
to Roboto inside `DataTable`; `muiTheme.ts`'s `#16A34A` vs. Tailwind v4's actual green-600;
`PageHeader.tsx`'s bare `sm:`; `BrandsPage`'s `rounded` (now documented as `rounded-sm` above, but
the class itself is unchanged); `PageHeader`'s `<h1>` rendering above its breadcrumb in DOM order.
