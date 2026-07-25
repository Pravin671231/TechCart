# admin-app — UI

**Project:** TechCart
**Scope:** Product Catalog (SRS v0.2) — every other feature is stubbed in §8, not designed
**Status:** Draft — design language and screens derived from the `mock-ui/admin/` prototype, raised to a normative target for implementation
**Related:** [docs/architecture.md](../architecture.md) §4.2 (SPA shape, role gating, libraries); [docs/srs/features/0.2-product-catalog.md](../srs/features/0.2-product-catalog.md) §6 (the requirements this realizes); [docs/ui/buyer-app.md](buyer-app.md) (buyer storefront); [mock-ui/admin/](../../mock-ui/admin/) (clickable prototype)

---

## 1. Purpose and source of truth

This document specifies **how the admin console looks and behaves**. It sits in a deliberate chain, and each link owns a different question:

| Artifact                                      | Owns                                                            |
| --------------------------------------------- | --------------------------------------------------------------- |
| `docs/architecture.md` §4.2                   | SPA shape, role gating, which libraries                         |
| `docs/srs/features/<version>-<feature>.md` §6 | **What** the UI must let an admin do — requirements, `FR-` IDs  |
| This document                                 | **How** it looks and behaves — design language, screens, states |
| `mock-ui/admin/`                              | A throwaway visual reference for this document                  |
| `admin-app/src/features/`                     | The implementation                                              |

Precedence, when two of them disagree:

- Root `docs/architecture.md` wins on architecture. This document never restates or overrides a root-level decision — it only says what the pixels do.
- The feature's SRS wins on requirements. If a screen here appears to add a capability, the SRS is short a requirement and should be amended there first; do not treat this document as a way to smuggle in scope.
- **This document wins over `mock-ui/`.** The prototype is a static HTML/vanilla-JS sketch with known, deliberate simplifications (see `mock-ui/README.md`) and several outright gaps — it has no accessibility affordances at all, its top bar is inert decoration, and its sidebar has no mobile behaviour whatsoever (§3, §7). Where the two differ, the prototype is wrong.

Implementation-level concerns for this workspace — Tailwind wiring, TypeScript project references, test setup — live in `admin-app/docs/architecture.md` and are not repeated here.

---

## 2. Visual language

The console's identity is **a dark shell around a light workspace**: a slate sidebar, a white top bar, a near-white content area, and an indigo accent carrying every primary action and active state. Density is higher than the storefront — this is a tool used for long stretches, not a shopfront.

Everything below is expressed in Tailwind utility classes, because Tailwind 4 is the styling layer for this workspace (`admin-app/docs/architecture.md`) and the default palette is used as-is.

### 2.1 Colour

| Role                        | Classes                                                                                                                                | Notes                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Page background / body text | `bg-neutral-50` / `text-neutral-900`                                                                                                   | The content area, not the sidebar                                                |
| Surface                     | `bg-white` + `border border-neutral-200`                                                                                               | Cards, tables, top bar                                                           |
| Shell (sidebar)             | `bg-slate-900 text-slate-300`; dividers `border-white/10`; hover `hover:bg-white/5 hover:text-white`; section label `text-slate-500`   | The only dark region                                                             |
| **Primary action / active** | `bg-indigo-600 text-white hover:bg-indigo-500`                                                                                         | Primary buttons, active nav item, and the current breadcrumb (`text-indigo-600`) |
| Secondary action            | `border border-neutral-300 hover:bg-neutral-100`, or `border-indigo-300 text-indigo-700 hover:bg-indigo-50` for accent-tinted outlines | Never two primaries in one region                                                |
| Focus ring                  | `focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`                                                                           | Applied to inputs; see §7.1 for the requirement                                  |
| Success                     | `bg-emerald-100 text-emerald-700`; banner `bg-emerald-50 text-emerald-700`                                                             | `published` status, save confirmation                                            |
| Danger                      | `bg-red-100 text-red-700`; `text-red-600` for zero stock and field errors                                                              | `archived` status, destructive actions, guard failures                           |
| Informational note          | `bg-amber-50 text-amber-700`                                                                                                           | Explanatory callouts, e.g. the "starting from" variant note                      |
| Muted text ladder           | `text-neutral-700` → `600` → `500` → `400`                                                                                             | Section heading → label → meta → placeholder                                     |

**Status tone map** — one mapping, used everywhere a status appears:

| Status                    | Classes                           |
| ------------------------- | --------------------------------- |
| `draft`                   | `bg-neutral-100 text-neutral-600` |
| `published`               | `bg-emerald-100 text-emerald-700` |
| `archived`                | `bg-red-100 text-red-700`         |
| Inactive (brand/category) | `bg-neutral-100 text-neutral-500` |

### 2.2 Typography

No `font-family` is declared — Tailwind's default `ui-sans-serif, system-ui` stack. Same scale as the storefront, with two console-specific additions:

| Use                                | Classes                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Page heading (`h1`)                | `text-2xl font-semibold tracking-tight`                         |
| Sidebar wordmark                   | `text-lg font-semibold tracking-tight`                          |
| Card / form-section heading (`h2`) | `text-sm font-semibold text-neutral-700`                        |
| Table header                       | `text-xs uppercase text-neutral-500`                            |
| Sidebar section label              | `text-xs font-semibold uppercase tracking-wider text-slate-500` |
| Body, table cells, controls        | `text-sm`                                                       |
| Helper text, badges, breadcrumb    | `text-xs`                                                       |

### 2.3 Spacing, radii, elevation

- **Content padding** — `px-6 py-6` on `<main>`.
- **Widths** — sidebar `w-64 shrink-0`; forms and detail views `max-w-3xl`; list pages run full width so tables have room.
- **Padding** — cards `p-5`; table cells `px-3 py-2`; controls `px-3 py-1.5` standard, `px-2 py-1` compact, `px-4 py-2` for a large primary button.
- **Rhythm** — form sections `space-y-8`; within a card `space-y-3`/`space-y-4`; grids `gap-2`/`gap-3`/`gap-4`/`gap-6`.
- **Radii** — `rounded-md` controls and buttons, `rounded-lg` cards, table wrappers and sidebar nav items, `rounded-full` count badges and avatars, `rounded` inline status pills.
- **Elevation** — none. The console uses borders exclusively; there is no shadow anywhere. If a floating surface (dropdown, drawer) is introduced, its elevation is a design decision to record here first.

### 2.4 Iconography

Inline Feather-style SVG paths, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, sized `h-5 w-5` (`h-4 w-4` inside a control). No icon library is a dependency today. Decorative icons take `aria-hidden="true"`; an icon that is the only content of a control needs an accessible name (§7.1) — the prototype's `title`-only buttons do not qualify.

### 2.5 Where these live in code

Tailwind 4 is wired CSS-first via the `@tailwindcss/vite` plugin and `@import "tailwindcss";` in `src/index.css` (see `admin-app/docs/architecture.md`). When these values start repeating across features, promote them to an `@theme` block in that same file rather than adding a `tailwind.config.js`.

### 2.6 Why this differs from `buyer-app`

The storefront uses near-black on near-white with no shell; the console uses indigo on slate with a persistent dark sidebar. This is **intentional**, not drift: different audiences, different session lengths, and no shared component code (there is no `packages/` directory in this repo — see `docs/architecture.md` §8). Neither app's palette is the "real" one, and neither should be conformed to the other. See [docs/ui/buyer-app.md](buyer-app.md) §2.

---

## 3. Layout and shell

Every admin page is: sidebar | (top bar → `<main>`). The page body is a flex row; the sidebar is the first child and the rest of the console is a flex column beside it.

### 3.1 Sidebar

`w-64 shrink-0`, full height, `bg-slate-900`:

- **Brand block** — an indigo rounded tile with the product initial, then the wordmark, over a `border-white/10` divider.
- **Section label** — "Catalog" (uppercase, tracked, `text-slate-500`). Later feature groups get their own labels rather than being appended to this one.
- **Nav items** — Products, Categories, Brands. Each is icon + label + a right-aligned count badge. Active is `bg-indigo-600 text-white` with a `bg-white/20` badge; inactive is `text-slate-300 hover:bg-white/5 hover:text-white` with a `bg-white/10 text-slate-400` badge.
- **Footer CTA** — "+ New product", full-width indigo, above a top divider.

The count badges must reflect current data. In the prototype they are computed once at page load and go stale the moment a brand or category is created or deleted; in the real console they read from the same query cache as the lists, so a mutation updates them.

### 3.2 Top bar

`bg-white` with a `border-neutral-200` bottom edge: a menu toggle, a global search field, utility icons, and a user block.

**This region is the biggest gap between prototype and product.** In `mock-ui/shared/admin-header.js` every control is inert — the hamburger, the search input, the theme toggle, the fullscreen button, and the notification bell (with its hard-coded "3") do nothing, and the user block is a static "Admin User / Administrator". The file says so in its own header comment.

The rule for the real console: **every control in the top bar is either genuinely wired or absent.** Shipping a visible-but-dead notification bell or theme toggle is worse than not having one. Concretely — the menu toggle must drive the mobile drawer (§3.5); the user block must show the signed-in account and its role, which means it cannot be built before Authentication (v0.3); global search, theme switching, and notifications are unspecified features with no SRS requirement behind them and should not appear until they have one.

### 3.3 Main content

`<main class="flex-1 px-6 py-6">`. Forms and detail views constrain to `max-w-3xl`; list pages run full width.

Note that four of the prototype's admin pages carry `mx-auto` on `<main>` with no `max-w`, which does nothing, while `admin/index.html` omits it — cosmetic inconsistency, not a pattern to reproduce.

### 3.4 Breadcrumb

`text-xs`, `/`-separated, sitting directly above the page heading; the current page is `font-medium text-indigo-600` and is not a link. The prototype renders these as a bare `<p>`; the real console uses a `<nav>` with an accessible name (§7.1).

### 3.5 Responsive shell

The prototype's sidebar is `w-64` at every breakpoint with no collapse, no drawer, and an unwired toggle — the console simply does not work on a narrow viewport. Required behaviour:

- At `lg` and above: the sidebar is persistent, exactly as today.
- Below `lg`: the sidebar becomes an off-canvas drawer, closed by default, opened by the top-bar menu toggle, dismissible by overlay click and by <kbd>Esc</kbd>, with focus trapped while open and returned to the toggle on close.
- Content never becomes horizontally scrollable at the page level; wide tables scroll inside their own `overflow-x-auto` wrapper (§4).

---

## 4. Component inventory

| Component              | Spec                                                                                                                                                                                                                                                    | Used on                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Data table             | Built on TanStack Table (`docs/architecture.md` §4.2). Wrapper `overflow-x-auto rounded-lg border border-neutral-200 bg-white`; `<thead>` `border-b bg-neutral-50 text-xs uppercase text-neutral-500`; rows `border-b border-neutral-100 last:border-0` | All list screens         |
| Status pill            | `rounded px-2 py-0.5 text-xs font-medium` + the §2.1 tone map                                                                                                                                                                                           | All list screens, detail |
| List-plus-side-form    | `grid grid-cols-1 gap-6 lg:grid-cols-3` — table in `lg:col-span-2`, form card in the remaining column. **Editing uses this persistent side panel, never a modal**; selecting a row retargets the form in place and reveals a "Cancel edit" control      | Categories, Brands       |
| Form section card      | `rounded-lg border border-neutral-200 bg-white p-5` with an `h2` heading and optional helper line; sections stack at `space-y-8`                                                                                                                        | Product form, detail     |
| Field + inline error   | Wrapping `<label>`, `text-sm` label in `text-neutral-600`, control below, error as `text-xs text-red-600` directly under the control                                                                                                                    | All forms                |
| Computed field         | Disabled input, `border-neutral-200 bg-neutral-50 text-neutral-500` — visibly not editable. Used for `sellingPrice`, which is server-computed (`FR-CAT-062`) and never accepted from the client                                                         | Product form             |
| Inline guard error     | A full-width error row rendered directly beneath the offending table row, `border-red-200 bg-red-50 text-red-700`, stating the count that blocks the action and what to do about it                                                                     | Categories, Brands       |
| Image picker           | File input constrained to `image/jpeg,image/png,image/webp`, with thumbnail previews and the count bound surfaced inline (1–8 per product, 1–2 per variant)                                                                                             | Product form, both lists |
| Repeatable variant row | A bordered block per variant: active toggle, remove control, SKU / MRP / discount / computed selling price / stock / optional weight, an attributes section, and an optional 0–2 image picker                                                           | Product form             |
| Dynamic spec fields    | Rendered from the selected category's `specificationGroups`, grouped by group name; input type follows the spec's declared type (`number` → number, `boolean` → yes/no, otherwise text); unit appended to the label                                     | Product form             |
| Save confirmation      | `bg-emerald-50 text-emerald-700` banner above the form, announced to assistive technology (§7.1)                                                                                                                                                        | Product form             |
| Empty state            | A single full-width row spanning every column, `text-neutral-400`, with copy naming the active search or filter                                                                                                                                         | All list screens         |
| Pagination             | Numbered buttons, hidden when there is one page — the same component the storefront uses                                                                                                                                                                | Product list             |

**No modal, drawer, toast, tab, or accordion pattern exists in the console today** (the mobile nav drawer in §3.5 will be the first). Introducing one is a design decision to record here — including its focus behaviour — not something to improvise at a call site.

---

## 5. Screens

Five screens exist today, all belonging to Product Catalog (SRS v0.2). Every one is behind the admin role gate: routes are declared in `src/app/App.tsx`, but authorization is enforced server-side by `backend` on every request (`docs/architecture.md` §4.2). Until Authentication lands in v0.3, admin write paths are protected by a temporary shared-secret header (`FR-CAT-030`–`032`) — that is a transport detail, not a UI one, and no screen here presents a login.

### 5.1 Product list

- **Route:** `/products` — the console's landing screen.
- **Regions:** breadcrumb → heading + "+ New product" CTA → filter bar → table → pagination.
- **Filter bar:** search box ("Search by name or SKU…"), a status select (All / Draft / Published / Archived), and a right-aligned result count.
- **Columns:** Image, Name, SKU, Brand, Category, Price, Stock, Status, actions. The Name cell carries a "N variants" sub-line when the product has variants; Price is prefixed `From ` when it is variant-derived (`FR-CAT-050`); Stock renders `text-red-600` at zero; actions are View (→ §5.2) and Edit (→ §5.3).
- **Shows every status** — draft, published, and archived products are all listed here, unlike any buyer-facing endpoint (`FR-CAT-017`).
- **States:** loading, loaded, empty ("No products match this search/filter."), error.
- **Requirements:** `FR-CAT-016`, `017`.

**Deviation from the prototype:** `mock-ui/admin/index.html` renders pagination _above_ the table. It belongs below, matching every buyer listing page.

### 5.2 Product detail (read-only)

- **Route:** `/products/:id`.
- A read-only view of every field at any status, deliberately distinct from the create/edit form (`FR-CAT-068`). Header row carries the breadcrumb, the product name, its status pill, and an "Edit product" CTA.
- **Sections:** Basic info (SKU, brand, category, slug, description), Price & stock (MRP, discount, selling price, stock — with the amber "starting from" note when active variants exist), Images, Specifications (grouped), and Variants.
- The Variants table lists **every** variant including inactive ones — columns SKU, Attributes, MRP, Discount, Selling price, Stock, Weight, Images, Status — with an explicit empty case for products that sell via their own SKU.
- Field/value pairs use `<dl>`/`<dt>`/`<dd>`, not a table.
- **States:** loaded, not found (dashed panel + link back to the list).
- **Requirements:** `FR-CAT-068`, plus `FR-CAT-047`/`050` for variant display.

### 5.3 Product create/edit form

- **Route:** `/products/new` and `/products/:id/edit`. The same form; the heading, breadcrumb, and submit behaviour switch on mode.
- **Five section cards, in order:**
  1. **Basic info** — Name, SKU, Brand (select), Category (select, subcategories indented under parents), Status, Description. Brand is required on every product (`FR-CAT-039`). Both selects list inactive brands and categories too — inactive means hidden from buyers, not unusable by admins.
  2. **Base price & stock** — MRP (₹), Discount (%, 0–99), Selling price (computed, disabled), Stock. When the product has variants, an amber note explains these become "starting from" display values only (`FR-CAT-050`).
  3. **Images** — 1–8, JPEG/PNG/WebP, with previews and the bound surfaced inline (`FR-CAT-028`, `029`).
  4. **Specifications** — fields rendered from the selected category's `specificationGroups`, re-rendered when the category changes, with an explicit empty case (`FR-CAT-041`, `043`).
  5. **Variants** — a repeatable row per variant (`FR-CAT-046`–`049`). Attribute inputs render per the category's variant-type definitions when they exist — a swatch picker for a `color` axis, a dropdown for `select`, a number input for `number` — and fall back to free-text name/value pairs otherwise (`FR-CAT-066`, `067`). Deactivating a variant is a soft delete; variants are never hard-removed (`FR-CAT-047`).
- **Validation:** client-side, mirroring the backend Zod schema without sharing code (§6.1). SKU uniqueness spans products _and_ variants in one namespace (`FR-CAT-012`).
- **States:** loading (edit mode), loaded, saving, saved, field-level invalid, not found.
- **Requirements:** `FR-CAT-011`–`015`, `018`–`020`, `028`, `029`, `039`, `041`, `043`, `046`–`050`, `061`, `062`, `066`, `067`.

**Deviation from the prototype:** `mock-ui/admin/product-form.html:38` defines the SKU-collision message but nothing ever shows it — `FR-CAT-012`'s uniqueness check is present in the markup and absent from the behaviour. It must actually be wired.

### 5.4 Category list and variant-type editor

- **Route:** `/categories`. List-plus-side-form layout.
- **Table columns:** Name, Parent, Products, Status, actions.
- **Category form:** Name, Parent category (optional; only top-level categories are offered, and a category can never be its own parent — the hierarchy is capped at two levels), Nav image (optional), an Active checkbox labelled for its effect ("visible in buyer-facing nav"), Save, and Cancel edit.
- **Delete guard:** blocked while the category has any products or subcategories, with an inline error naming both counts and what to do about them. A successful delete cascades to that category's specification and variant-type definitions (`FR-CAT-024`).
- **Variant-type editor:** a second card, visible only while editing an existing category. Lists the category's variant types and offers an add form — Name, Code, Type (`select` / `color` / `text` / `number`), a Required flag that is explicitly a UI hint only, and an options list for `select`/`color` types entered as `Label:value` pairs. Removing a variant type is **never** blocked, because these definitions only drive the product form's rendering and are not validated server-side (`FR-CAT-066`, `067`) — the helper text should say so, so nobody assumes a missing guard is a bug.
- **States:** loading, loaded, empty, guard-blocked, editing.
- **Requirements:** `FR-CAT-021`–`025`, `063`, `064`, `066`, `067`.

### 5.5 Brand list

- **Route:** `/brands`. Same list-plus-side-form layout.
- **Table columns:** Logo, Name, "Products (all statuses)", Status, actions. The column header states "all statuses" deliberately — the count that governs the delete guard includes draft and archived products (`FR-CAT-036`), so a brand can look unused on the storefront and still be undeletable.
- **Brand form:** Name, Description (optional), Logo (optional), an Active checkbox labelled for its effect ("visible in buyer-facing brand list"), Save, and Cancel edit.
- **Delete guard:** blocked while any product of any status references the brand, with an inline error naming the count.
- **States:** loading, loaded, empty, guard-blocked, editing.
- **Requirements:** `FR-CAT-033`–`037`, `065`.

---

## 6. State and interaction conventions

### 6.1 Validation

- Client-side validation exists for UX and **mirrors** `backend`'s Zod schemas without sharing code — there is no shared validation package, by decision (root `CLAUDE.md`; `docs/architecture.md` §6). The server is what enforces correctness; the client is convenience.
- Because the two can drift, a server rejection must always render, even for a case the client believed valid. Never assume a request that passed client validation will succeed.
- Validate a field on blur and on submit, not on every keystroke. Show errors inline at the field, and move focus to the first invalid field on a failed submit.
- Backend errors arrive as `{ success, code, message }`. Map `code` to copy in the UI; never render a raw backend `message`.

### 6.2 Prices

MRP and discount are entered; **selling price is never entered**. It is computed as `mrp - floor(mrp * discount / 100)` server-side on every write (`FR-CAT-062`) and shown live in a disabled field as the admin types, so the effect of a discount is visible before saving. Prices are stored as integer paise and displayed as `₹` with `en-IN` grouping (`FR-CAT-018`); discount is an integer 0–99 (`FR-CAT-061`). The same rules apply per variant (`FR-CAT-049`).

### 6.3 Variants change what "the product" means

A product with zero active variants sells on its own SKU, price, and stock. Once it has one or more active variants, it sells **per variant**, and the base price/stock become "starting from" display values only (`FR-CAT-050`). The UI must make this switch visible at the moment it happens — the amber note in the price section appears as soon as a variant row exists, not only after saving.

### 6.4 Status and visibility

- Product status is a three-state lifecycle: `draft`, `published`, `archived`. Deleting a product sets `archived`; nothing is hard-deleted (`FR-CAT-016`).
- Brand and category `status` is a boolean that controls buyer-facing visibility only (`FR-CAT-063`, `065`). It does **not** bypass the delete guards (`FR-CAT-024`, `036`), and inactive records stay fully usable inside the console.
- The console shows everything regardless of status. That is the point of it — never filter the admin views by buyer-facing visibility.

### 6.5 Destructive and mutating actions

- Deletes that a guard can block show the guard's reason inline, at the row, with the blocking count and the remedy. Never fail silently, and never present a delete that will always be rejected as though it might succeed.
- Any control that mutates data needs a confirmation step. The prototype makes the status pill a one-click toggle that flips a record's visibility with no confirmation and only a `title` to explain it — do not carry that forward; status changes go through the edit form or an explicit confirm.
- After a successful mutation, the affected list, the result count, and the sidebar count badges all refresh together (§3.1).

### 6.6 Escaping

Product, brand, and category names are free text that later renders on a public storefront. React escapes by default — do not reach for `dangerouslySetInnerHTML` with catalog data. (The prototype interpolates unescaped strings into `innerHTML` throughout; that is safe only because its data is a hard-coded fixture.)

---

## 7. Accessibility and responsive requirements

**These are requirements for `admin-app`, not descriptions of the prototype.** SRS v0.9 will specify system-wide frontend NFRs; until it lands, this section is the bar. An internal tool is not exempt — staff use assistive technology too, and a console is used for hours at a time.

### 7.1 Accessibility

- Every interactive element has a visible focus indicator. `focus:outline-none` is only acceptable when paired with a replacement ring in the same class list.
- Icon-only controls carry an accessible name via `aria-label`. A `title` attribute is not an accessible name — every utility control in the prototype's top bar currently fails this.
- The active sidebar item is marked `aria-current="page"`.
- Sortable table columns expose their state with `aria-sort` and are operable from the keyboard; sorting is triggered by a real `<button>` inside the header cell.
- Delete-guard errors, save confirmations, and result counts are announced — `aria-live="polite"` for counts and confirmations, `role="alert"` for guard failures and submit-blocking errors.
- When the side form retargets to edit a row, focus moves to the form's first field so keyboard users are not left at the table.
- The mobile nav drawer (§3.5) traps focus while open, closes on <kbd>Esc</kbd>, and restores focus to the toggle that opened it.
- Breadcrumbs are a `<nav>` with an accessible name.
- Form fields keep their `<label>` association — including dynamically generated spec and variant fields — and invalid fields set `aria-invalid` plus `aria-describedby` pointing at the error text.
- Colour is never the only carrier of meaning: status pills carry their word, and a zero stock value is not communicated by red alone.

### 7.2 Responsive

Tailwind's default breakpoints, mobile-first:

| Breakpoint | Behaviour                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| base       | Sidebar is an off-canvas drawer; list and form columns stack; form fields single-column                         |
| `sm`       | Form fields go two-column; price/stock and variant field rows go four-column; user block appears in the top bar |
| `lg`       | Sidebar becomes persistent; list-plus-side-form splits into its 2:1 grid                                        |

Wide tables scroll inside their own `overflow-x-auto` wrapper rather than reflowing — a catalog grid with nine columns is not usefully stackable — but the page itself must never scroll horizontally.

### 7.3 Where `mock-ui` falls short

Do not copy these forward:

| Gap in the prototype                                                      | What `admin-app` must do instead                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Zero `aria-*` attributes anywhere in the whole prototype                  | §7.1 in full                                               |
| Sidebar is `w-64` at every breakpoint; hamburger is unwired               | Off-canvas drawer below `lg`, with a working toggle (§3.5) |
| Top-bar search, theme, fullscreen, notifications and user block are inert | Wire it or remove it — nothing decorative ships (§3.2)     |
| Status pill mutates data on a single unconfirmed click                    | Confirmation on every mutating control (§6.5)              |
| Icon-only buttons labelled by `title` only                                | `aria-label` on every icon-only control                    |
| Breadcrumbs are a bare `<p>`                                              | A `<nav>` with an accessible name (§3.4)                   |
| Sidebar count badges computed once at load, stale after any CRUD          | Counts read from the same cache as the lists (§3.1)        |
| Pagination sits above the product table                                   | Below the table, matching the storefront (§5.1)            |
| `#sku-error` exists in markup but is never shown                          | `FR-CAT-012`'s uniqueness check actually wired (§5.3)      |
| Unescaped `innerHTML` interpolation of catalog data                       | Escaped rendering (§6.6)                                   |

---

## 8. Not yet specified

No screens are designed for the areas below, and none should be invented here. Each becomes a section in this document when its SRS version is written and reviewed — the SRS comes first (root `CLAUDE.md`, "Development process").

| Area                  | SRS version | Already fixed by `docs/architecture.md` §4.2                                          |
| --------------------- | ----------- | ------------------------------------------------------------------------------------- |
| Login / session       | v0.3        | Better Auth issues the session; role claims gate routes                               |
| Role-gated navigation | v0.3        | `catalog-manager`, `order-manager`, `super-admin` — checked server-side every request |
| Order management      | v0.5        | TanStack Table for order grids                                                        |
| Dashboard / analytics | v0.7        | Recharts for charts                                                                   |
| Settings              | —           | —                                                                                     |

Two consequences worth planning around now: the sidebar will need more than one section group, and its items must be filtered by the signed-in role — a `order-manager` should not see catalog management at all. That filtering is a convenience, never the security boundary; the server rejects unauthorized requests regardless of what the client renders.

---

## 9. Implementation notes

- **Where the code goes.** Each screen is a feature under `src/features/<feature>/`; `src/app/App.tsx` holds the explicit React Router route declarations and stays thin. This is `admin-app`'s existing convention — see `admin-app/AGENTS.md`.
- **Data fetching.** TanStack Query for fetching, caching, and invalidation; TanStack Table for the catalog grids (`docs/architecture.md` §4.2). List queries, count badges, and result counts should share cache keys so one mutation updates all three.
- **Validation.** `admin-app`'s own client-side schemas, mirroring but not importing `backend`'s — see §6.1 and root `CLAUDE.md`.
- **Images.** Uploads go directly to R2 through a presigned URL requested from `backend` (`FR-CAT-054`–`059`); the API never receives image bytes. The form holds local previews until the record is saved.
- **Errors.** Every backend error arrives as `{ success, code, message }` (`docs/architecture.md` §6). Map `code` to copy in the UI layer.
- **Keeping this in sync.** When a screen changes, update this document in the same PR as the code. When the SRS data model changes, the order is: SRS → this document → `mock-ui/` → implementation.
