# admin-app — UI

**Project:** TechCart
**Scope:** Console shell (header, sidebar, main region) + Product Catalog screens (SRS v0.2). Every other feature appears in the nav as a disabled entry and is stubbed in §8, not designed
**Status:** Draft — normative target for implementation; `mock-ui/admin/` is built to match it
**Related:** [docs/architecture.md](../architecture.md) §4.2 (SPA shape, role gating, libraries); [docs/srs/SRS.md](../srs/SRS.md) §3 (the feature index the sidebar is built from); [docs/srs/features/0.2-product-catalog.md](../srs/features/0.2-product-catalog.md) §6 (catalog requirements); [docs/ui/buyer-app.md](buyer-app.md) (buyer storefront); [mock-ui/admin/](../../mock-ui/admin/) (clickable prototype)

---

## 1. Purpose and source of truth

This document specifies **how the admin console looks and behaves**. It sits in a deliberate chain, and each link owns a different question:

| Artifact                                      | Owns                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `docs/architecture.md` §4.2                   | SPA shape, role gating, which libraries                         |
| `docs/srs/SRS.md` §3                          | Which features exist at all — the sidebar is generated from it  |
| `docs/srs/features/<version>-<feature>.md` §6 | **What** the UI must let an admin do — requirements, `FR-` IDs  |
| This document                                 | **How** it looks and behaves — design language, screens, states |
| `mock-ui/admin/`                              | A throwaway visual reference for this document                  |
| `admin-app/src/features/`                     | The implementation                                              |

Precedence, when two of them disagree:

- Root `docs/architecture.md` wins on architecture. This document never restates or overrides a root-level decision — it only says what the pixels do.
- The feature's SRS wins on requirements. If a screen here appears to add a capability, the SRS is short a requirement and should be amended there first; do not treat this document as a way to smuggle in scope.
- **This document wins over `mock-ui/`.** The prototype is a static HTML/vanilla-JS sketch with deliberate simplifications (see `mock-ui/README.md`). Where the two differ, the prototype is wrong.

**One rule that governs the whole document.** The sidebar (§3.2) lists all six features from the SRS feature index, but only Product Catalog has a specification. The other five render as **disabled entries** — they communicate the shape of the finished console without inventing requirements. A disabled entry is not a design, and a screen behind it may not be built until its SRS version is written and reviewed, per root `CLAUDE.md`'s `Feature → SRS → Milestone → Issue → Code` process. Do not read §3.2's nav list as permission to design User, Cart, or Order Management.

Implementation-level concerns for this workspace — Tailwind wiring, TypeScript project references, test setup — live in `admin-app/docs/architecture.md` and are not repeated here.

---

## 2. Visual language

The console's identity is **a dark shell around a workspace**: a slate sidebar, a surface-coloured top bar, an indigo accent carrying every primary action and active state. Density is higher than the storefront — this is a tool used for long stretches, not a shopfront.

The console supports **light and dark themes** as equals. Neither is a degraded variant of the other, and every component in §4 must be legible in both.

### 2.1 Colour

| Role                             | Light                                                                                | Dark                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Page background / body text      | `bg-neutral-50` / `text-neutral-900`                                                 | `bg-slate-950` / `text-slate-100`                                  |
| Surface (cards, tables, top bar) | `bg-white` + `border-neutral-200`                                                    | `bg-slate-900` + `border-slate-800`                                |
| Shell (sidebar)                  | `bg-slate-900 text-slate-300`, dividers `border-white/10`                            | `bg-slate-950 text-slate-300`, dividers `border-slate-800`         |
| Shell hover                      | `hover:bg-white/5 hover:text-white`                                                  | same                                                               |
| **Primary action / active**      | `bg-indigo-600 text-white hover:bg-indigo-500`                                       | `bg-indigo-500 text-white hover:bg-indigo-400`                     |
| Secondary action                 | `border-neutral-300 hover:bg-neutral-100`                                            | `border-slate-700 hover:bg-slate-800`                              |
| Input                            | `border-neutral-300 bg-white`                                                        | `border-slate-700 bg-slate-950 text-slate-100`                     |
| Focus ring                       | `focus-visible:ring-2 focus-visible:ring-indigo-100 focus-visible:border-indigo-400` | `focus-visible:ring-indigo-500/40 focus-visible:border-indigo-500` |
| Success                          | `bg-emerald-100 text-emerald-700`                                                    | `bg-emerald-500/15 text-emerald-300`                               |
| Danger                           | `bg-red-100 text-red-700`; `text-red-600` for zero stock and field errors            | `bg-red-500/15 text-red-300`; `text-red-400`                       |
| Informational note               | `bg-amber-50 text-amber-700`                                                         | `bg-amber-500/10 text-amber-300`                                   |
| Muted text ladder                | `text-neutral-700` → `600` → `500` → `400`                                           | `text-slate-300` → `400` → `500` → `600`                           |
| Disabled                         | `text-neutral-400`                                                                   | `text-slate-600`                                                   |

**Status tone map** — one mapping, used everywhere a status appears:

| Status                    | Light                             | Dark                                 |
| ------------------------- | --------------------------------- | ------------------------------------ |
| `draft`                   | `bg-neutral-100 text-neutral-600` | `bg-slate-700/50 text-slate-300`     |
| `published`               | `bg-emerald-100 text-emerald-700` | `bg-emerald-500/15 text-emerald-300` |
| `archived`                | `bg-red-100 text-red-700`         | `bg-red-500/15 text-red-300`         |
| Inactive (brand/category) | `bg-neutral-100 text-neutral-500` | `bg-slate-700/50 text-slate-400`     |

Note the sidebar is dark in **both** themes — it is the shell, not the workspace. In dark mode it goes one step darker than the surface so the two still separate.

### 2.2 Theme mechanics

- Class-based, not media-query-based, because the user's explicit choice must beat the OS preference.
- **Resolution order on load:** stored preference in `localStorage` → `prefers-color-scheme` → light. The class is applied to `<html>` **before first paint**; a flash of the wrong theme is a defect, not a nicety.
- The choice persists across reloads and across pages.
- Real app (Tailwind 4, CSS-first): `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`, per `admin-app/docs/architecture.md`'s wiring. Prototype (Tailwind Play CDN): `tailwind.config = { darkMode: "class" }`.

### 2.3 Typography

No `font-family` is declared — Tailwind's default `ui-sans-serif, system-ui` stack.

| Use                                | Classes                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Page heading (`h1`)                | `text-2xl font-semibold tracking-tight`                         |
| Sidebar wordmark                   | `text-lg font-semibold tracking-tight`                          |
| Card / form-section heading (`h2`) | `text-sm font-semibold`                                         |
| Table header                       | `text-xs uppercase`                                             |
| Sidebar section label              | `text-xs font-semibold uppercase tracking-wider text-slate-500` |
| Body, table cells, controls        | `text-sm`                                                       |
| Helper text, badges, breadcrumb    | `text-xs`                                                       |

### 2.4 Spacing, radii, elevation

- **Content padding** — `px-6 py-6` on `<main>`.
- **Widths** — sidebar `w-64` expanded, `w-16` collapsed; forms and detail views `max-w-3xl`; list pages full width.
- **Header height** — `h-16` (4rem), fixed. This is a layout token, not a styling preference: the sidebar and the scroll region both size themselves against it in CSS (§3.6), so it has to be a known value rather than whatever the header's contents happen to add up to.
- **Padding** — cards `p-5`; table cells `px-3 py-2`; controls `px-3 py-1.5` standard, `px-2 py-1` compact, `px-4 py-2` large primary.
- **Rhythm** — form sections `space-y-8`; within a card `space-y-3`/`space-y-4`; grids on the 2/3/4/6 steps.
- **Radii** — `rounded-md` controls and buttons, `rounded-lg` cards, table wrappers, nav items and the dropdown panel, `rounded-full` count badges and avatars, `rounded` inline status pills.
- **Elevation** — flat by default; borders do the separating. The **only** elevated surfaces are the ones that float above the page: the user menu (§4) and the mobile nav drawer (§3.5). Both use `shadow-lg`. Nothing else gets a shadow.

### 2.5 Iconography

Inline Feather-style SVG paths, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, sized `h-5 w-5` (`h-4 w-4` inside a control). No icon library is a dependency. Decorative icons take `aria-hidden="true"`; an icon that is the only content of a control needs an accessible name (§7.1).

### 2.6 Why this differs from `buyer-app`

The storefront uses near-black on near-white with no shell and no dark mode; the console uses indigo on slate with a persistent shell and both themes. This is **intentional**, not drift: different audiences, different session lengths, and no shared component code (there is no `packages/` directory — see `docs/architecture.md` §8). Neither app's palette is the "real" one. See [docs/ui/buyer-app.md](buyer-app.md) §2.

---

## 3. Layout and shell

Every admin page is: header across the top, then sidebar | `<main>` beneath it.

```
┌─────────────────────────────────────────────┐
│ header — full width, sticky, h-16           │
├───────────┬─────────────────────────────────┤
│ sidebar   │ main                            │
│ fixed     │ the only scrollable region      │
│ under the │                                 │
│ header    │                                 │
└───────────┴─────────────────────────────────┘
```

The header owns the full viewport width and sits above everything; the sidebar starts below it and runs to the bottom of the viewport. Neither moves — see §3.6.

### 3.1 Header

A single row across the **full viewport width**, `bg-white dark:bg-slate-900` with a bottom border, `sticky top-0`, and a fixed `h-16` (§2.4). Four regions, left to right:

| Control            | Behaviour                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sidebar toggle** | At `lg`+ toggles the sidebar between expanded (`w-64`) and an icon rail (`w-16`); below `lg` opens the off-canvas drawer. State persists (§3.4)                                                                                                        |
| **Search**         | Searches products by name and SKU. Submitting navigates to the product list with the query applied, so the result is a linkable URL rather than a transient overlay. It is a catalog search today — the placeholder must say so, not "Search anything" |
| **Theme toggle**   | Switches light ↔ dark, persists immediately (§2.2). Icon reflects the theme that is **currently active**, and the accessible name says which theme activating it will produce                                                                          |
| **User block**     | Avatar, name, role, chevron. Opens the user menu — the console's one dropdown (§4)                                                                                                                                                                     |

**Every control in this header is functional.** A visible-but-dead control is worse than an absent one: it advertises a capability that does not exist. That rule is why fullscreen and notification controls are _not_ in this spec — neither has a requirement behind it. If one is wanted later, it gets a requirement first, then a row in this table.

The user menu's items are the one honest exception, and they are handled by rendering rather than pretending: the menu opens, closes, and handles focus for real, but its entries (Profile, Settings, Sign out) are **visibly unavailable** and labelled with the SRS version that will deliver them, because Authentication is v0.3. They are never dead links.

### 3.2 Sidebar

`bg-slate-900 dark:bg-slate-950`, `w-64` expanded / `w-16` collapsed.

**Position:** fixed to the left edge, starting immediately below the header and running to the bottom of the viewport — `top` equals the header height, height is `calc(100dvh - 4rem)`. It never scrolls with the content and never occupies layout space, so `<main>` sits beside it via a left offset that tracks the collapse state.

**Structure:** brand block → nav → footer. The nav is generated from `docs/srs/SRS.md` §3's feature index, so the console's navigation and the project's scope cannot drift apart:

| Nav item         | SRS feature     | Version | State in the console today                 |
| ---------------- | --------------- | ------- | ------------------------------------------ |
| Product Catalog  | Product Catalog | v0.2    | **Enabled** — Products, Categories, Brands |
| User Management  | Authentication  | v0.3    | Disabled                                   |
| Cart Management  | Shopping Cart   | v0.4    | Disabled                                   |
| Order Management | Orders          | v0.5    | Disabled                                   |
| Payments         | Payments        | v0.6    | Disabled                                   |
| Dashboard        | Dashboard       | v0.7    | Disabled                                   |

- **Product Catalog** is a group: the parent shows its three children (Products, Categories, Brands), each with a live count badge. Counts come from the same cache as the lists, so a create or delete updates them immediately.
- **Disabled entries** render at reduced emphasis, are not focusable as links, carry `aria-disabled="true"`, and show their SRS version as a visible tag rather than a hover-only tooltip — a tooltip alone is invisible on touch and to screen readers.
- **Active item** is `bg-indigo-600 dark:bg-indigo-500 text-white`.
- **Collapsed rail** shows icons only; labels become accessible names, and the active indicator stays visible.
- The footer holds the theme-independent app version/build marker. The "+ New product" CTA is **not** here — a create action belongs to the screen that owns it (§3.3), not to global navigation.

### 3.3 Main region

Four parts, in order, on every list screen:

1. **Breadcrumb** — `text-xs`, `/`-separated, current page not a link. A real `<nav>` with an accessible name.
2. **Title row** — `h1` on the left, the primary **Add** button on the right (`+ New product`, `+ New category`, `+ New brand`). One primary action per screen.
3. **Table** — see §4 and §5.1.
4. **Pagination** — **below** the table, always. Above-the-table pagination reads as a filter and is wrong.

Filters and search for the screen sit between the title row and the table.

### 3.4 Persistence

| State                 | Persists? | Where                                   |
| --------------------- | --------- | --------------------------------------- |
| Theme                 | Yes       | `localStorage`, applied pre-paint       |
| Sidebar collapsed     | Yes       | `localStorage`                          |
| Mobile drawer open    | No        | Always closed on load                   |
| Sort column/direction | Yes       | URL query, so a sorted view is linkable |
| Search, filters, page | Yes       | URL query, same reason                  |

### 3.5 Responsive

Tailwind's default breakpoints, mobile-first:

| Breakpoint | Behaviour                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base       | Sidebar is an off-canvas drawer over an overlay, sliding in **beneath** the header rather than over it; `<main>` has no left offset; list and form columns stack; form fields single-column; user block collapses to the avatar |
| `sm`       | Form fields two-column; price/stock and variant rows four-column; user name and role appear                                                                                                                                     |
| `lg`       | Sidebar becomes persistent and the toggle switches to expand/collapse; `<main>`'s left offset tracks the sidebar width; list-plus-side-form splits into its 2:1 grid                                                            |

The drawer closes on overlay click and on <kbd>Esc</kbd>, traps focus while open, and returns focus to the toggle. The header stays visible and usable at every breakpoint, drawer open or not — it is above the sidebar in the stacking order, so the toggle that opened the drawer is always reachable to close it.

### 3.6 Scroll model

The shell is locked to the viewport: the document itself never scrolls.

- `<body>` is `h-dvh overflow-hidden`.
- The header is `sticky top-0` at `z-40`; the sidebar is `fixed` at `z-30`; the drawer overlay is `z-20`. That ordering is what puts the header above the sidebar while the sidebar begins below it.
- **`<main>` is the only vertical scroll container** — `h-[calc(100dvh-4rem)] overflow-y-auto`. Header and sidebar are physically incapable of scrolling away, rather than merely appearing not to.
- `dvh`, not `vh`, so mobile browser chrome doesn't clip the bottom of the sidebar or the scroll region as it shows and hides.
- Wide tables keep their own `overflow-x-auto` wrapper — a horizontal scroller nested inside the vertical one. A nine-column catalog grid is not usefully stackable, but the shell itself must never scroll horizontally at any breakpoint.

The practical consequence for screens: a long list scrolls its rows while the title row, breadcrumb and Add button scroll away with them — those belong to the content, not the shell. If a screen ever needs a sticky element of its own (a table header, a wizard footer), it sticks inside `<main>`, not to the viewport.

---

## 4. Component inventory

| Component              | Spec                                                                                                                                                                                                                                                                                                                   | Used on            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Sidebar toggle         | Icon button in the header. Expand/collapse at `lg`+, open drawer below. `aria-expanded` reflects state; accessible name changes with it                                                                                                                                                                                | Header             |
| Theme toggle           | Icon button, `aria-pressed` for the dark state, name states the target theme. Persists on click (§2.2)                                                                                                                                                                                                                 | Header             |
| Header search          | `type="search"` in a form; submit navigates to the product list with the query in the URL. Placeholder names its scope ("Search products by name or SKU")                                                                                                                                                              | Header             |
| User menu              | The console's **only** dropdown. Opens on click or <kbd>Enter</kbd>/<kbd>Space</kbd>; <kbd>↑</kbd>/<kbd>↓</kbd> move between items; <kbd>Esc</kbd> or an outside click closes and returns focus to the trigger. `aria-haspopup="menu"` + `aria-expanded`; panel is `role="menu"`, items `role="menuitem"`. `shadow-lg` | Header             |
| Nav item               | Icon + label + optional count badge. Disabled variant: reduced emphasis, `aria-disabled`, visible SRS-version tag, not focusable as a link                                                                                                                                                                             | Sidebar            |
| Data table             | TanStack Table (`docs/architecture.md` §4.2). Wrapper `overflow-x-auto rounded-lg border`; header row `text-xs uppercase` on a tinted background; rows separated by hairlines                                                                                                                                          | All list screens   |
| Sortable column header | A real `<button>` inside the `<th>`, full-width, with an indicator showing unsorted / ascending / descending. The `<th>` carries `aria-sort`. Cycles asc → desc → unsorted                                                                                                                                             | All list screens   |
| Row title link         | The primary identifying cell (product name) is a link to that record's preview page. The rest of the row is not clickable — a whole-row click target swallows text selection and hides the destination                                                                                                                 | Product list       |
| Status pill            | `rounded px-2 py-0.5 text-xs font-medium` + the §2.1 tone map                                                                                                                                                                                                                                                          | Lists, preview     |
| Pagination             | Numbered buttons, hidden when there is one page, `aria-current="page"` on the active one. Below the table                                                                                                                                                                                                              | All list screens   |
| Wizard stepper         | Four numbered steps with labels and a current/complete/upcoming state each. Completed steps are clickable; upcoming ones are not. Announces the step change (§7.1)                                                                                                                                                     | Product wizard     |
| Step footer            | Back / Next on steps 1–3; Back / Save on step 4. Next is blocked by step validation (§6.3), and the reason is shown at the field, not only on the button                                                                                                                                                               | Product wizard     |
| Preview summary panel  | Read-only grouped summary of everything captured in the wizard, each group with a control returning to the step that owns it                                                                                                                                                                                           | Wizard step 4      |
| List-plus-side-form    | `grid lg:grid-cols-3` — table in `lg:col-span-2`, form card beside it. **Editing uses this persistent side panel, never a modal**                                                                                                                                                                                      | Categories, Brands |
| Form section card      | `rounded-lg border p-5` with an `h2` and optional helper line                                                                                                                                                                                                                                                          | Wizard, detail     |
| Field + inline error   | Wrapping `<label>`, control, error as `text-xs` danger text directly beneath                                                                                                                                                                                                                                           | All forms          |
| Computed field         | Disabled input, visibly not editable. Used for `sellingPrice`, which is server-computed (`FR-CAT-062`) and never accepted from the client                                                                                                                                                                              | Wizard steps 1, 3  |
| Inline guard error     | Full-width error row beneath the offending table row, stating the blocking count and the remedy                                                                                                                                                                                                                        | Categories, Brands |
| Image picker           | File input limited to JPEG/PNG/WebP with thumbnail previews and the count bound surfaced inline (1–8 per product, 1–2 per variant)                                                                                                                                                                                     | Wizard steps 2, 3  |
| Repeatable variant row | Bordered block: active toggle, remove, SKU / MRP / discount / computed selling price / stock / optional weight, attributes, optional 0–2 images                                                                                                                                                                        | Wizard step 3      |
| Dynamic spec fields    | Rendered from the selected category's `specificationGroups`; input type follows the declared type; unit appended to the label                                                                                                                                                                                          | Wizard step 2      |
| Empty state            | Full-width row spanning every column, naming the active search or filter                                                                                                                                                                                                                                               | All list screens   |

No toast, tab, or accordion pattern exists. Introducing one is a design decision to record here — including its focus behaviour — not something to improvise at a call site.

---

## 5. Screens

Every screen is behind the admin role gate: routes are declared in `src/app/App.tsx`, but authorization is enforced server-side by `backend` on every request (`docs/architecture.md` §4.2). Until Authentication lands in v0.3, admin write paths are protected by a temporary shared-secret header (`FR-CAT-030`–`032`) — a transport detail, not a UI one.

### 5.1 Product list

- **Route:** `/products` — the console's landing screen.
- **Regions:** breadcrumb → title row with **+ New product** → search + status filter → table → pagination.
- **Columns:** Image, Name, SKU, Brand, Category, Price, Stock, Status, actions.
  - **Name** is the link to the preview (§5.2) and carries a "N variants" sub-line when the product has variants.
  - **Price** is prefixed `From ` when variant-derived (`FR-CAT-050`); **Stock** renders in danger colour at zero.
  - **Sortable:** Name, SKU, Brand, Category, Price, Stock, Status. **Not sortable:** Image, actions.
  - Sort is single-column, tri-state (asc → desc → unsorted), and lives in the URL (§3.4).
- **Shows every status** — draft, published and archived are all listed, unlike any buyer-facing endpoint (`FR-CAT-017`).
- **States:** loading, loaded, empty ("No products match this search/filter."), error.
- **Requirements:** `FR-CAT-016`, `017`.

### 5.2 Product preview

- **Route:** `/products/:id`. Reached from the product-list name link and from wizard step 4.
- A read-only view of every field at any status, deliberately distinct from the create/edit wizard (`FR-CAT-068`). Header row carries breadcrumb, product name, status pill, and an **Edit** action that opens the wizard.
- **Sections:** Basic info (SKU, brand, category, slug, description), Price & stock (with the "starting from" note when active variants exist), Images, Specifications (grouped), Variants.
- The Variants table lists **every** variant including inactive ones — SKU, Attributes, MRP, Discount, Selling price, Stock, Weight, Images, Status — with an explicit empty case for products that sell via their own SKU.
- Field/value pairs use `<dl>`/`<dt>`/`<dd>`, not a table.
- **States:** loaded, not found.
- **Requirements:** `FR-CAT-068`, plus `FR-CAT-047`/`050` for variant display.

### 5.3 Product wizard

- **Route:** `/products/new` and `/products/:id/edit`. Same wizard; the heading and the final action differ by mode.
- A stepper across the top, one step visible at a time, a step footer beneath.

| Step | Name                      | Contents                                                                                                                  | Must be valid to advance                                                                                                                                  |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Basic Information         | Name, SKU, Brand, Category, Status, Description, MRP, Discount, computed Selling price, Stock                             | Required fields present; SKU unique (`FR-CAT-012`); brand set (`FR-CAT-039`); MRP > 0 integer; discount 0–99 (`FR-CAT-061`); stock a non-negative integer |
| 2    | Images and Specifications | 1–8 images (JPEG/PNG/WebP) with previews; spec fields rendered from the category chosen in step 1                         | Image count within 1–8 (`FR-CAT-028`, `029`); every `required` spec present (`FR-CAT-043`)                                                                |
| 3    | Add Variants              | Repeatable variant rows; attribute inputs rendered per the category's variant-type definitions, falling back to free text | Each row: unique SKU in the shared namespace, valid price/stock (`FR-CAT-049`), no duplicate attribute combination (`FR-CAT-048`). Zero variants is valid |
| 4    | Preview                   | Read-only summary of steps 1–3, each group linking back to its step; the save action                                      | —                                                                                                                                                         |

- **Step 2 depends on step 1's category.** Changing the category after filling step 2 re-renders the spec fields; values for specs that still exist are kept, and the ones that no longer apply are dropped with a visible notice rather than silently.
- **Step 3 changes what step 1 means.** As soon as one variant row exists, step 1's price and stock become "starting from" display values (`FR-CAT-050`) — say so on both steps, at the moment it becomes true.
- **Nothing is persisted until step 4's save.** Leaving mid-wizard discards the draft, and the user is warned before that happens.
- **States:** loading (edit mode), per-step editing, per-step invalid, saving, saved, not found.
- **Requirements:** `FR-CAT-011`–`015`, `018`–`020`, `028`, `029`, `039`, `041`, `043`, `046`–`050`, `061`, `062`, `066`, `067`.

### 5.4 Category list and variant-type editor

- **Route:** `/categories`. Breadcrumb → title row with **+ New category** → list-plus-side-form.
- **Columns:** Name, Parent, Products, Status, actions. Sortable: Name, Parent, Products, Status.
- **Category form:** Name, Parent category (optional; only top-level categories offered, never itself — the hierarchy is capped at two levels), Nav image (optional), an Active checkbox labelled for its effect, Save, Cancel edit.
- **Delete guard:** blocked while the category has any products or subcategories, with an inline error naming both counts. A successful delete cascades to that category's specification and variant-type definitions (`FR-CAT-024`).
- **Variant-type editor:** a second card, visible only while editing an existing category. Fields: Name, Code, Type (`select`/`color`/`text`/`number`), a Required flag that is **explicitly a UI hint only**, and an options list for `select`/`color` entered as `Label:value` pairs. Removing a variant type is **never** blocked — these definitions only drive the wizard's step-3 rendering and are not validated server-side (`FR-CAT-066`, `067`). The helper text says so, so nobody reads the missing guard as a bug.
- **Requirements:** `FR-CAT-021`–`025`, `063`, `064`, `066`, `067`.

### 5.5 Brand list

- **Route:** `/brands`. Breadcrumb → title row with **+ New brand** → list-plus-side-form.
- **Columns:** Logo, Name, "Products (all statuses)", Status, actions. Sortable: Name, Products, Status.
- The column header states "all statuses" deliberately — the count governing the delete guard includes draft and archived products (`FR-CAT-036`), so a brand can look unused on the storefront and still be undeletable.
- **Brand form:** Name, Description (optional), Logo (optional), an Active checkbox labelled for its effect, Save, Cancel edit.
- **Requirements:** `FR-CAT-033`–`037`, `065`.

### 5.6 The disabled nav entries

User Management, Cart Management, Order Management, Payments and Dashboard have **no screens**, by design. They exist in the nav so the console's eventual shape is visible and so the sidebar stays tied to `docs/srs/SRS.md` §3. Clicking one does nothing.

When one of them is specified, the order is: write its SRS feature doc → add its screens to §5 of this document → build. Turning a disabled entry into a working link without those first two steps is exactly the shortcut this repo's process exists to prevent.

---

## 6. State and interaction conventions

### 6.1 Validation

- Client-side validation exists for UX and **mirrors** `backend`'s Zod schemas without sharing code — there is no shared validation package, by decision (root `CLAUDE.md`; `docs/architecture.md` §6). The server enforces correctness; the client is convenience.
- Because the two can drift, a server rejection must always render, even for a case the client believed valid.
- Validate a field on blur and on step advance, not on every keystroke. Show errors inline at the field, and move focus to the first invalid field when an advance is blocked.
- Backend errors arrive as `{ success, code, message }`. Map `code` to copy in the UI; never render a raw backend `message`.

### 6.2 Sorting

Single-column, tri-state (ascending → descending → unsorted), reflected in `aria-sort` and in the URL. Sorting resets to page 1 and leaves search and filters untouched. Only the columns named in §5 are sortable — a sortable-looking header that does nothing is a defect.

### 6.3 Wizard rules

- **Forward is gated, backward is free.** Advancing runs the current step's validation; returning to a completed step never does. A completed step is reachable from the stepper; an unvisited one is not.
- **The step footer explains itself.** When Next is blocked, the reason appears at the offending field — a disabled button with no explanation is a dead end.
- **Step 4 is read-only.** Edits happen by returning to the owning step, not inline in the preview.
- **Save happens once**, at step 4. There is no autosave and no partial record.
- **Leaving is destructive and must be warned about**, in both create and edit mode.

### 6.4 Prices

MRP and discount are entered; **selling price is never entered**. It is computed as `mrp - floor(mrp * discount / 100)` server-side on every write (`FR-CAT-062`) and shown live in a disabled field as the admin types. Prices are stored as integer paise and displayed as `₹` with `en-IN` grouping (`FR-CAT-018`); discount is an integer 0–99 (`FR-CAT-061`). The same rules apply per variant (`FR-CAT-049`).

### 6.5 Status and visibility

- Product status is a three-state lifecycle: `draft`, `published`, `archived`. Deleting a product sets `archived`; nothing is hard-deleted (`FR-CAT-016`).
- Brand and category `status` is a boolean controlling buyer-facing visibility only (`FR-CAT-063`, `065`). It does **not** bypass the delete guards (`FR-CAT-024`, `036`), and inactive records stay fully usable inside the console.
- The console shows everything regardless of status. Never filter admin views by buyer-facing visibility.

### 6.6 Destructive and mutating actions

- Guarded deletes show the guard's reason inline, at the row, with the blocking count and the remedy. Never fail silently.
- Any control that mutates data needs a confirmation step. A status pill that flips a record's visibility on a single unconfirmed click is not acceptable; status changes go through the form or an explicit confirm.
- After a successful mutation, the affected list, the result count, and the sidebar count badges refresh together.

### 6.7 Escaping

Product, brand and category names are free text that later renders on a public storefront. React escapes by default — do not reach for `dangerouslySetInnerHTML` with catalog data.

---

## 7. Accessibility and responsive requirements

**These are requirements for `admin-app`.** SRS v0.9 will specify system-wide frontend NFRs; until it lands, this section is the bar. An internal tool is not exempt — staff use assistive technology too, and a console is used for hours at a time.

### 7.1 Accessibility

- Every interactive element has a visible focus indicator, in **both** themes. `focus:outline-none` is only acceptable when paired with a replacement ring in the same class list.
- Icon-only controls carry an accessible name via `aria-label`. A `title` attribute is not an accessible name.
- **Theme toggle** — `aria-pressed` for the dark state; the name states what activating it will do, not what is currently shown.
- **Sidebar toggle** — `aria-expanded`, plus `aria-controls` pointing at the sidebar.
- **Active nav item** — `aria-current="page"`. **Disabled entries** — `aria-disabled="true"`, removed from the tab order, with the reason visible as text rather than a tooltip.
- **User menu** — `aria-haspopup="menu"` and `aria-expanded` on the trigger; `role="menu"`/`role="menuitem"` on the panel; arrow-key movement, <kbd>Esc</kbd> to close, focus returned to the trigger, and focus trapped while open.
- **Sortable columns** — `aria-sort` on the `<th>`, a real `<button>` inside it, and a sort change announced politely.
- **Wizard** — the stepper conveys position ("Step 2 of 4") as text, not colour alone; the step region is labelled; changing step moves focus to the new step's heading and announces it.
- Delete-guard errors, save confirmations and result counts are announced — `aria-live="polite"` for counts and confirmations, `role="alert"` for guard failures and blocked advances.
- When the side form retargets to edit a row, focus moves to the form's first field.
- The mobile drawer traps focus, closes on <kbd>Esc</kbd>, and restores focus to its toggle.
- Breadcrumbs are a `<nav>` with an accessible name.
- Form fields keep their `<label>` association — including dynamically generated spec and variant fields — and invalid fields set `aria-invalid` plus `aria-describedby`.
- Colour is never the only carrier of meaning: status pills carry their word, sort direction carries an icon, and a zero stock value is not communicated by red alone.
- **Contrast is a requirement in both themes.** A dark palette that fails against `slate-950` is as broken as a light one that fails against white.

### 7.2 Responsive

See §3.5 for the breakpoint table and drawer behaviour.

### 7.3 Where `mock-ui` falls short

The prototype is built to this document, so most of the old gaps are closed. What remains deliberately unbuilt there:

| Gap in the prototype                                          | Why it stays                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nothing persists past reload except theme and sidebar state   | No backend; documented in `mock-ui/README.md`                                   |
| No real auth; the shared-secret guard isn't modelled          | Authentication is v0.3                                                          |
| No real image upload — blob previews only                     | No R2/presign flow in a static prototype                                        |
| Unescaped `innerHTML` interpolation                           | Safe only because the data is a hard-coded fixture; the real app escapes (§6.7) |
| Filters and sort held in memory, not the URL                  | The real app puts them in the URL (§3.4)                                        |
| Full TanStack Table behaviour (column sizing, virtualization) | The prototype hand-rolls the minimum needed to validate the layout              |

---

## 8. Not yet specified

These now appear in the sidebar as disabled entries (§3.2, §5.6). Each becomes a section in §5 when its SRS version is written and reviewed — the SRS comes first (root `CLAUDE.md`, "Development process").

| Nav entry        | SRS feature    | Version | Already fixed by `docs/architecture.md` §4.2                                                                            |
| ---------------- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| User Management  | Authentication | v0.3    | Better Auth issues the session; role claims (`catalog-manager`, `order-manager`, `super-admin`) gate routes server-side |
| Cart Management  | Shopping Cart  | v0.4    | —                                                                                                                       |
| Order Management | Orders         | v0.5    | TanStack Table for order grids                                                                                          |
| Payments         | Payments       | v0.6    | —                                                                                                                       |
| Dashboard        | Dashboard      | v0.7    | Recharts for charts                                                                                                     |

Two consequences worth planning around now: the user block and its menu cannot be finished until v0.3 supplies a real account and role; and once roles exist, nav entries must be filtered by the signed-in role — a `order-manager` should not see catalog management. That filtering is a convenience, never the security boundary; the server rejects unauthorized requests regardless of what the client renders.

---

## 9. Implementation notes

- **Where the code goes.** Each screen is a feature under `src/features/<feature>/`; `src/app/App.tsx` holds the explicit React Router route declarations and stays thin (`admin-app/AGENTS.md`). The shell — sidebar, header, theme — is itself a feature, not something each screen re-implements.
- **Data fetching.** TanStack Query for fetching, caching and invalidation; TanStack Table for the grids (`docs/architecture.md` §4.2). List queries, count badges and result counts should share cache keys so one mutation updates all three.
- **Wizard state.** Held in one form model across all four steps so step 4 can render a preview without refetching, and so a category change in step 1 can invalidate step 2's spec values deliberately (§5.3).
- **Validation.** `admin-app`'s own client-side schemas, mirroring but not importing `backend`'s — §6.1 and root `CLAUDE.md`.
- **Images.** Uploads go directly to R2 through a presigned URL requested from `backend` (`FR-CAT-054`–`059`); the API never receives image bytes. The wizard holds local previews until step 4's save.
- **Errors.** Every backend error arrives as `{ success, code, message }` (`docs/architecture.md` §6). Map `code` to copy in the UI layer.
- **Keeping this in sync.** When a screen changes, update this document in the same PR as the code. When the SRS data model changes, the order is: SRS → this document → `mock-ui/` → implementation.
