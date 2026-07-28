# admin-app — Main UI

**Project:** TechCart
**Scope:** The console itself — project information, purpose, objectives, target users, layout structure, design guidelines, UI components, accessibility, the UI feature index, interaction conventions and implementation notes. Per-feature screens live in their own feature docs under `docs/ui/admin/`
**Status:** Draft — normative target for implementation; `mock-ui/admin/` is built to match it
**Related:** [docs/ui/README.md](../README.md) (document chain, precedence, conventions); [docs/architecture.md](../../architecture.md) §4.2 (SPA shape, role gating, libraries); [docs/srs/SRS.md](../../srs/SRS.md) §3 (the feature index the sidebar is built from); [buyer/buyer-main-ui.md](../buyer/buyer-main-ui.md) (buyer storefront); [mock-ui/admin/](../../../mock-ui/admin/) (clickable prototype)

---

## Contents

1. [Project Information](#1-project-information)
2. [Purpose](#2-purpose)
3. [Objectives](#3-objectives)
4. [Target Users](#4-target-users)
5. [Layout Structure](#5-layout-structure)
6. [Design Guidelines](#6-design-guidelines)
7. [UI Components](#7-ui-components)
8. [Accessibility](#8-accessibility)
9. [UI Feature Index](#9-ui-feature-index)
10. [Interaction Conventions](#10-interaction-conventions)
11. [Implementation Notes](#11-implementation-notes)
12. [Version History](#12-version-history)

---

## 1. Project Information

|                     |                                                                                                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application**     | `admin-app` — the TechCart management console                                                                                                                                                                                                                           |
| **Workspace**       | `admin-app/` (npm workspace, flat at repo root)                                                                                                                                                                                                                         |
| **Shape**           | Single-page application. React 19 + Vite + TypeScript, React Router for routing                                                                                                                                                                                         |
| **Styling**         | Tailwind CSS 4, wired CSS-first — no `tailwind.config.js`. Default palette, no custom ramp                                                                                                                                                                              |
| **Data**            | TanStack Query for fetching and caching; TanStack Table for grids                                                                                                                                                                                                       |
| **API**             | The shared `backend/` Express service. No business logic lives in this app                                                                                                                                                                                              |
| **Where code goes** | `src/features/<feature>/` per screen; `src/app/App.tsx` holds route declarations and stays thin                                                                                                                                                                         |
| **Authorization**   | Every screen is behind the admin role gate. Routes are declared client-side, but authorization is enforced **server-side** by `backend` on every request ([docs/architecture.md](../../architecture.md) §4.2). A client-side route guard is never the security boundary |

Until Authentication lands in SRS v0.3, admin write paths are protected by a temporary shared-secret header (`FR-CAT-030`–`032`) — a transport detail, not a UI one.

Implementation-level concerns for this workspace — Tailwind wiring, TypeScript project references, test setup — live in `admin-app/docs/architecture.md` and are not repeated here.

---

## 2. Purpose

This document specifies **how the admin console looks and behaves** at the whole-app level: the design language every screen inherits, the shell every screen sits inside, and the conventions every screen follows. Individual screens are specified in feature docs.

**What this document owns:** the design language, the shell, the shared components, and the conventions every screen follows. What it deliberately does not own: architecture decisions (root `docs/architecture.md`), requirements (the feature's SRS §6), and individual screens (the feature docs).

The full document chain and the precedence rules that resolve disagreements between those artifacts are stated once, for both apps, in [docs/ui/README.md](../README.md#precedence). They are not repeated here — a second copy is a second thing to keep true.

**One rule governs the whole document set.** The sidebar lists all six features from the SRS feature index, but only Product Catalog has a specification. The other five render as **disabled entries** — they communicate the shape of the finished console without inventing requirements. A disabled entry is not a design, and a screen behind it may not be built until its SRS version is written and reviewed, per root `CLAUDE.md`'s `Feature → SRS → Milestone → Issue → Code` process. Do not read [§9](#9-ui-feature-index) as permission to design User, Cart, or Order Management.

---

## 3. Objectives

What this console is optimising for, in priority order. When two of these conflict, the higher one wins.

1. **Every visible control does something.** A visible-but-dead control is worse than an absent one: it advertises a capability that does not exist. This is why the header carries no fullscreen or notification button — neither has a requirement behind it.
2. **Density over decoration.** Staff work here for hours at a stretch, not seconds. Rows are compact, chrome is flat, colour carries meaning rather than mood.
3. **State is addressable.** Sort, search, filters and page live in the URL, so any view a user is looking at can be linked, bookmarked and reloaded ([§5.4](#54-persistence)).
4. **Nothing fails silently.** A blocked delete names its blocking count and the remedy; a rejected save renders the reason at the field that caused it ([§7.4](#74-error-messages)).
5. **Accessible by default, in both themes.** An internal tool is not exempt — staff use assistive technology too ([§8](#8-accessibility)).
6. **The document leads the code.** When a screen changes, the feature doc changes in the same PR ([§11](#11-implementation-notes)).

---

## 4. Target Users

The three admin roles defined in [docs/srs/SRS.md](../../srs/SRS.md) §2.3. All three are authenticated staff; none is a customer.

| Role                | Uses the console to                                  | Sees                                          |
| ------------------- | ---------------------------------------------------- | --------------------------------------------- |
| **Catalog Manager** | Manage products, categories, brands and inventory    | Product Catalog. Not order or user management |
| **Order Manager**   | Manage the order lifecycle, refunds, shipping status | Order Management. Not catalog management      |
| **Super Admin**     | Everything, including user and role management       | All nav entries                               |

Role-based nav filtering arrives with Authentication (SRS v0.3) — until then every signed-in user sees the full nav. When it lands, filtering the nav by role is a **convenience**: the server rejects unauthorized requests regardless of what the client renders.

Characteristics that shaped the design: long sessions on desktop-class screens, repeated multi-step data entry, and a strong need to see records at every status — the console never hides a record because buyers cannot see it ([§10.2](#102-destructive-and-mutating-actions)).

---

## 5. Layout Structure

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

The header owns the full viewport width and sits above everything; the sidebar starts below it and runs to the bottom of the viewport. Neither moves — see [§5.5](#55-scroll-model). How this collapses on small screens is in [§6.4](#64-responsive-design).

### 5.1 Header

A single row across the **full viewport width**, `bg-white dark:bg-slate-900` with a bottom border, `sticky top-0`, and a fixed `h-16` ([§6.3](#63-spacing-radii-and-elevation)). Four regions, left to right:

| Control            | Behaviour                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sidebar toggle** | At `lg`+ toggles the sidebar between expanded (`w-64`) and an icon rail (`w-16`); below `lg` opens the off-canvas drawer. State persists ([§5.4](#54-persistence))                                                                                     |
| **Search**         | Searches products by name and SKU. Submitting navigates to the product list with the query applied, so the result is a linkable URL rather than a transient overlay. It is a catalog search today — the placeholder must say so, not "Search anything" |
| **Theme toggle**   | Switches light ↔ dark, persists immediately ([§6.1](#61-color-guidelines)). Icon reflects the theme that is **currently active**, and the accessible name says which theme activating it will produce                                                  |
| **User block**     | Avatar, name, role, chevron. Opens the user menu — the console's one dropdown ([§7.5](#75-component-inventory))                                                                                                                                        |

**Every control in this header is functional** ([§3](#3-objectives), objective 1). If a fullscreen or notification control is wanted later, it gets a requirement first, then a row in this table.

The user menu's items are the one honest exception, and they are handled by rendering rather than pretending: the menu opens, closes, and handles focus for real, but its entries (Profile, Settings, Sign out) are **visibly unavailable** and labelled with the SRS version that will deliver them, because Authentication is v0.3. They are never dead links.

### 5.2 Sidebar

`bg-slate-900 dark:bg-slate-950`, `w-64` expanded / `w-16` collapsed.

**Position:** fixed to the left edge, starting immediately below the header and running to the bottom of the viewport — `top` equals the header height, height is `calc(100dvh - 4rem)`. It never scrolls with the content and never occupies layout space, so `<main>` sits beside it via a left offset that tracks the collapse state.

**Structure:** brand block → nav → footer. The nav is generated from [docs/srs/SRS.md](../../srs/SRS.md) §3's feature index, so the console's navigation and the project's scope cannot drift apart — [§9](#9-ui-feature-index) is that nav's contents, one row per entry.

- **Product Catalog** is a group: the parent shows its three children (Products, Categories, Brands), each with a live count badge. Counts come from the same cache as the lists, so a create or delete updates them immediately.
- **Disabled entries** render at reduced emphasis, are not focusable as links, carry `aria-disabled="true"`, and show their SRS version as a visible tag rather than a hover-only tooltip — a tooltip alone is invisible on touch and to screen readers.
- **Active item** is `bg-indigo-600 dark:bg-indigo-500 text-white`.
- **Collapsed rail** shows icons only; labels become accessible names, and the active indicator stays visible.
- The footer holds the theme-independent app version/build marker. The "+ New product" CTA is **not** here — a create action belongs to the screen that owns it ([§5.3](#53-main-region)), not to global navigation.

### 5.3 Main region

Four parts, in order, on every list screen:

1. **Breadcrumb** — `text-xs`, `/`-separated, current page not a link. A real `<nav>` with an accessible name.
2. **Title row** — `h1` on the left, the primary **Add** button on the right (`+ New product`, `+ New category`, `+ New brand`). One primary action per screen ([§7.2](#72-buttons)).
3. **Table** — see [§7.5](#75-component-inventory) and the owning feature doc.
4. **Pagination** — **below** the table, always. Above-the-table pagination reads as a filter and is wrong.

Filters and search for the screen sit between the title row and the table.

### 5.4 Persistence

| State                 | Persists? | Where                                   |
| --------------------- | --------- | --------------------------------------- |
| Theme                 | Yes       | `localStorage`, applied pre-paint       |
| Sidebar collapsed     | Yes       | `localStorage`                          |
| Mobile drawer open    | No        | Always closed on load                   |
| Sort column/direction | Yes       | URL query, so a sorted view is linkable |
| Search, filters, page | Yes       | URL query, same reason                  |

### 5.5 Scroll model

The shell is locked to the viewport: the document itself never scrolls.

- `<body>` is `h-dvh overflow-hidden`.
- The header is `sticky top-0` at `z-40`; the sidebar is `fixed` at `z-30`; the drawer overlay is `z-20`. That ordering is what puts the header above the sidebar while the sidebar begins below it.
- **`<main>` is the only vertical scroll container** — `h-[calc(100dvh-4rem)] overflow-y-auto`. Header and sidebar are physically incapable of scrolling away, rather than merely appearing not to.
- `dvh`, not `vh`, so mobile browser chrome doesn't clip the bottom of the sidebar or the scroll region as it shows and hides.
- Wide tables keep their own `overflow-x-auto` wrapper — a horizontal scroller nested inside the vertical one. A nine-column catalog grid is not usefully stackable, but the shell itself must never scroll horizontally at any breakpoint.

The practical consequence for screens: a long list scrolls its rows while the title row, breadcrumb and Add button scroll away with them — those belong to the content, not the shell. If a screen ever needs a sticky element of its own (a table header, a wizard footer), it sticks inside `<main>`, not to the viewport.

---

## 6. Design Guidelines

The console's identity is **a dark shell around a workspace**: a slate sidebar, a surface-coloured top bar, an indigo accent carrying every primary action and active state. Density is higher than the storefront — this is a tool used for long stretches, not a shopfront.

This section defines the tokens. [§7](#7-ui-components) composes them into components.

### 6.1 Color Guidelines

The console supports **light and dark themes as equals**. Neither is a degraded variant of the other, and every component in [§7](#7-ui-components) must be legible in both.

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

**Theme mechanics**

- Class-based, not media-query-based, because the user's explicit choice must beat the OS preference.
- **Resolution order on load:** stored preference in `localStorage` → `prefers-color-scheme` → light. The class is applied to `<html>` **before first paint**; a flash of the wrong theme is a defect, not a nicety.
- The choice persists across reloads and across pages.
- Real app (Tailwind 4, CSS-first): `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`, per `admin-app/docs/architecture.md`'s wiring. Prototype (Tailwind Play CDN): `tailwind.config = { darkMode: "class" }`.

### 6.2 Typography

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

### 6.3 Spacing, radii and elevation

- **Content padding** — `px-6 py-6` on `<main>`.
- **Widths** — sidebar `w-64` expanded, `w-16` collapsed; forms and detail views `max-w-3xl`; list pages full width.
- **Header height** — `h-16` (4rem), fixed. This is a layout token, not a styling preference: the sidebar and the scroll region both size themselves against it in CSS ([§5.5](#55-scroll-model)), so it has to be a known value rather than whatever the header's contents happen to add up to.
- **Padding** — cards `p-5`; table cells `px-3 py-2`; controls `px-3 py-1.5` standard, `px-2 py-1` compact, `px-4 py-2` large primary.
- **Rhythm** — form sections `space-y-8`; within a card `space-y-3`/`space-y-4`; grids on the 2/3/4/6 steps.
- **Radii** — `rounded-md` controls and buttons, `rounded-lg` cards, table wrappers, nav items and the dropdown panel, `rounded-full` count badges and avatars, `rounded` inline status pills.
- **Elevation** — flat by default; borders do the separating. The **only** elevated surfaces are the ones that float above the page: the user menu ([§7.5](#75-component-inventory)) and the mobile nav drawer ([§6.4](#64-responsive-design)). Both use `shadow-lg`. Nothing else gets a shadow.

### 6.4 Responsive Design

Tailwind's default breakpoints, mobile-first:

| Breakpoint | Behaviour                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base       | Sidebar is an off-canvas drawer over an overlay, sliding in **beneath** the header rather than over it; `<main>` has no left offset; list and form columns stack; form fields single-column; user block collapses to the avatar |
| `sm`       | Form fields two-column; price/stock and variant rows four-column; user name and role appear                                                                                                                                     |
| `lg`       | Sidebar becomes persistent and the toggle switches to expand/collapse; `<main>`'s left offset tracks the sidebar width; list-plus-side-form splits into its 2:1 grid                                                            |

The drawer closes on overlay click and on <kbd>Esc</kbd>, traps focus while open, and returns focus to the toggle. The header stays visible and usable at every breakpoint, drawer open or not — it is above the sidebar in the stacking order, so the toggle that opened the drawer is always reachable to close it.

### 6.5 Browser Support

**Not yet specified.** Browser support is a system-wide frontend non-functional requirement owned by **SRS v0.9** ([docs/srs/SRS.md](../../srs/SRS.md) §3), which has not been written.

Until v0.9 lands, the working assumption is current evergreen Chrome, Edge, Firefox and Safari. Treat that as an assumption, not a commitment: no code should depend on it, and no support claim should be made to anyone on the strength of this paragraph. When v0.9 specifies the matrix, this section is replaced by a pointer to it.

### 6.6 Icons

Inline Feather-style SVG paths, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, sized `h-5 w-5` (`h-4 w-4` inside a control). No icon library is a dependency. Decorative icons take `aria-hidden="true"`; an icon that is the only content of a control needs an accessible name ([§8](#8-accessibility)).

### 6.7 Why this differs from `buyer-app`

The storefront uses near-black on near-white with no shell and no dark mode; the console uses indigo on slate with a persistent shell and both themes. This is **intentional**, not drift: different audiences, different session lengths, and no shared component code (there is no `packages/` directory — see [docs/architecture.md](../../architecture.md) §8). Neither app's palette is the "real" one. See [buyer/buyer-main-ui.md §6](../buyer/buyer-main-ui.md#6-design-guidelines).

---

## 7. UI Components

Components used by the shell or by more than one feature, composed from the tokens in [§6](#6-design-guidelines). A component that exists only inside one feature belongs in that feature's doc §2, not here.

### 7.1 Forms

**Layout.** Forms and detail views are `max-w-3xl`. Fields are single-column at base and two-column from `sm` ([§6.4](#64-responsive-design)). Form sections are separated by `space-y-8`; content within a card by `space-y-3`/`space-y-4`.

**Form section card** — `rounded-lg border p-5` with an `h2` (`text-sm font-semibold`) and an optional helper line beneath it.

**Field + inline error** — a wrapping `<label>`, the control, then the error as `text-xs` danger text directly beneath the control. Inputs are `border-neutral-300 bg-white` (`border-slate-700 bg-slate-950 text-slate-100` dark), `rounded-md`, `px-3 py-1.5`.

**Rules.**

- A field's label is always associated with its control — including dynamically generated fields. Placeholder text is never a substitute for a label.
- Invalid fields set `aria-invalid` and `aria-describedby` pointing at the error text ([§8](#8-accessibility)).
- A value the server computes is rendered as a **disabled input**, visibly not editable, rather than as plain text — it stays in the form's visual rhythm while being obviously not yours to set.
- Editing uses a persistent panel or a dedicated route, never a modal. No modal pattern exists in this console.

### 7.2 Buttons

Three sizes, two emphases, one shape. All are `rounded-md` and carry the [§6.1](#61-color-guidelines) focus ring.

| Variant       | Classes                                                                                       | Use                                        |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Primary**   | `bg-indigo-600 text-white hover:bg-indigo-500` (`bg-indigo-500 … hover:bg-indigo-400` dark)   | The one affirmative action on a screen     |
| **Secondary** | `border border-neutral-300 hover:bg-neutral-100` (`border-slate-700 hover:bg-slate-800` dark) | Cancel, Back, and every non-primary action |
| **Icon-only** | Same as secondary, square, icon at `h-4 w-4`                                                  | Header controls, row actions               |

| Size     | Padding       | Use                                              |
| -------- | ------------- | ------------------------------------------------ |
| Large    | `px-4 py-2`   | The primary action in a title row or form footer |
| Standard | `px-3 py-1.5` | Everything else                                  |
| Compact  | `px-2 py-1`   | Inside a table row or a dense toolbar            |

**Rules.**

- **One primary action per screen.** Two competing primaries means the screen is doing two jobs.
- A disabled button always has its reason visible somewhere on the screen — at the offending field, not only on the button. A disabled control with no explanation is a dead end.
- An icon-only button needs an accessible name via `aria-label`; a `title` attribute is not an accessible name.
- A button that mutates data goes through the confirmation rules in [§10.2](#102-destructive-and-mutating-actions).

### 7.3 Validation Rules

- Client-side validation exists for UX and **mirrors** `backend`'s Zod schemas without sharing code — there is no shared validation package, by decision (root `CLAUDE.md`; [docs/architecture.md](../../architecture.md) §6). The server enforces correctness; the client is convenience.
- Because the two can drift, a server rejection must always render, even for a case the client believed valid.
- Validate a field on blur and on step advance, **not on every keystroke**.
- Show errors inline at the field, and move focus to the first invalid field when an advance is blocked.

### 7.4 Error Messages

**The contract.** Every backend error arrives as `{ success: false, code: string, message: string }` ([docs/architecture.md](../../architecture.md) §6). Map `code` to copy in the UI layer. **Never render a raw backend `message`** — it is a developer string, not user-facing copy.

| Kind                | Renders as                                                                                         | Announced as         |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| Field error         | `text-xs` danger text directly beneath the control; field gets `aria-invalid` + `aria-describedby` | —                    |
| Blocked advance     | The reason at the offending field, plus focus moved there                                          | `role="alert"`       |
| Guarded delete      | A full-width error row beneath the offending table row, stating the blocking count and the remedy  | `role="alert"`       |
| Save confirmation   | Inline near the action                                                                             | `aria-live="polite"` |
| Result count change | Inline above the table                                                                             | `aria-live="polite"` |

**Rules.**

- Every failure states the **remedy**, not just the fact. "Cannot delete: 5 products, 2 subcategories" tells an admin what to do next; "Delete failed" does not.
- Nothing fails silently ([§3](#3-objectives), objective 4).
- Errors are scoped to what failed. A failed save must not blank the form.
- Colour is never the only carrier — an error says so in words, not merely in red.

### 7.5 Component inventory

Forms and buttons are specified above; this table covers the rest.

| Component              | Spec                                                                                                                                                                                                                                                                                                                   | Used on          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Sidebar toggle         | Icon button in the header. Expand/collapse at `lg`+, open drawer below. `aria-expanded` reflects state; accessible name changes with it                                                                                                                                                                                | Header           |
| Theme toggle           | Icon button, `aria-pressed` for the dark state, name states the target theme. Persists on click ([§6.1](#61-color-guidelines))                                                                                                                                                                                         | Header           |
| Header search          | `type="search"` in a form; submit navigates to the product list with the query in the URL. Placeholder names its scope ("Search products by name or SKU")                                                                                                                                                              | Header           |
| User menu              | The console's **only** dropdown. Opens on click or <kbd>Enter</kbd>/<kbd>Space</kbd>; <kbd>↑</kbd>/<kbd>↓</kbd> move between items; <kbd>Esc</kbd> or an outside click closes and returns focus to the trigger. `aria-haspopup="menu"` + `aria-expanded`; panel is `role="menu"`, items `role="menuitem"`. `shadow-lg` | Header           |
| Nav item               | Icon + label + optional count badge. Disabled variant: reduced emphasis, `aria-disabled`, visible SRS-version tag, not focusable as a link                                                                                                                                                                             | Sidebar          |
| Data table             | TanStack Table ([docs/architecture.md](../../architecture.md) §4.2). Wrapper `overflow-x-auto rounded-lg border`; header row `text-xs uppercase` on a tinted background; rows separated by hairlines                                                                                                                   | All list screens |
| Sortable column header | A real `<button>` inside the `<th>`, full-width, with an indicator showing unsorted / ascending / descending. The `<th>` carries `aria-sort`. Cycles asc → desc → unsorted                                                                                                                                             | All list screens |
| Status pill            | `rounded px-2 py-0.5 text-xs font-medium` + the [§6.1](#61-color-guidelines) tone map                                                                                                                                                                                                                                  | Lists, detail    |
| Pagination             | Numbered buttons, hidden when there is one page, `aria-current="page"` on the active one. Below the table                                                                                                                                                                                                              | All list screens |
| Empty state            | Full-width row spanning every column, naming the active search or filter                                                                                                                                                                                                                                               | All list screens |

No toast, tab, accordion or modal pattern exists. Introducing one is a design decision to record here — including its focus behaviour — not something to improvise at a call site.

---

## 8. Accessibility

**These are requirements for `admin-app`.** SRS v0.9 will specify system-wide frontend NFRs; until it lands, this section is the bar. An internal tool is not exempt — staff use assistive technology too, and a console is used for hours at a time.

- Every interactive element has a visible focus indicator, in **both** themes. `focus:outline-none` is only acceptable when paired with a replacement ring in the same class list.
- Icon-only controls carry an accessible name via `aria-label`. A `title` attribute is not an accessible name.
- **Theme toggle** — `aria-pressed` for the dark state; the name states what activating it will do, not what is currently shown.
- **Sidebar toggle** — `aria-expanded`, plus `aria-controls` pointing at the sidebar.
- **Active nav item** — `aria-current="page"`. **Disabled entries** — `aria-disabled="true"`, removed from the tab order, with the reason visible as text rather than a tooltip.
- **User menu** — `aria-haspopup="menu"` and `aria-expanded` on the trigger; `role="menu"`/`role="menuitem"` on the panel; arrow-key movement, <kbd>Esc</kbd> to close, focus returned to the trigger, and focus trapped while open.
- **Sortable columns** — `aria-sort` on the `<th>`, a real `<button>` inside it, and a sort change announced politely.
- **Wizard** — the stepper conveys position ("Step 2 of 4") as text, not colour alone; the step region is labelled; changing step moves focus to the new step's heading and announces it.
- Delete-guard errors, save confirmations and result counts are announced — `aria-live="polite"` for counts and confirmations, `role="alert"` for guard failures and blocked advances ([§7.4](#74-error-messages)).
- When a side form retargets to edit a row, focus moves to the form's first field.
- The mobile drawer traps focus, closes on <kbd>Esc</kbd>, and restores focus to its toggle.
- Breadcrumbs are a `<nav>` with an accessible name.
- Form fields keep their `<label>` association — including dynamically generated spec and variant fields — and invalid fields set `aria-invalid` plus `aria-describedby`.
- Colour is never the only carrier of meaning: status pills carry their word, sort direction carries an icon, and a zero stock value is not communicated by red alone.
- **Contrast is a requirement in both themes.** A dark palette that fails against `slate-950` is as broken as a light one that fails against white.

---

## 9. UI Feature Index

The sidebar's contents, one row per entry, generated from [docs/srs/SRS.md](../../srs/SRS.md) §3 so navigation and project scope cannot drift apart.

The feature ↔ SRS ↔ UI-doc mapping is maintained once, in [docs/ui/README.md](../README.md#feature-status). This table adds only what is specific to the console: the version tag the nav shows, and the entry's rendered state.

| Nav entry        | SRS feature     | Version tag shown in nav | State in the console today                 |
| ---------------- | --------------- | ------------------------ | ------------------------------------------ |
| Product Catalog  | Product Catalog | —                        | **Enabled** — Products, Categories, Brands |
| User Management  | Authentication  | v0.3                     | Disabled                                   |
| Cart Management  | Shopping Cart   | v0.4                     | Disabled                                   |
| Order Management | Orders          | v0.5                     | Disabled                                   |
| Payments         | Payments        | v0.6                     | Disabled                                   |
| Dashboard        | Dashboard       | v0.7                     | Disabled                                   |

### 9.1 The disabled entries

User Management, Cart Management, Order Management, Payments and Dashboard have **no screens**, by design. They exist in the nav so the console's eventual shape is visible and so the sidebar stays tied to [docs/srs/SRS.md](../../srs/SRS.md) §3. Clicking one does nothing.

When one of them is specified, follow [docs/ui/README.md](../README.md#adding-a-features-ui-doc) — SRS doc first, then this table, then the feature doc, then the code. Turning a disabled entry into a working link without those first steps is exactly the shortcut this repo's process exists to prevent.

Some of their architecture is already fixed, and should not be re-decided when their SRS is written:

| Nav entry        | SRS feature    | Version | Already fixed by [docs/architecture.md](../../architecture.md) §4.2                                                     |
| ---------------- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| User Management  | Authentication | v0.3    | Better Auth issues the session; role claims (`catalog-manager`, `order-manager`, `super-admin`) gate routes server-side |
| Cart Management  | Shopping Cart  | v0.4    | —                                                                                                                       |
| Order Management | Orders         | v0.5    | TanStack Table for order grids                                                                                          |
| Payments         | Payments       | v0.6    | —                                                                                                                       |
| Dashboard        | Dashboard      | v0.7    | Recharts for charts                                                                                                     |

Two consequences worth planning around now: the user block and its menu cannot be finished until v0.3 supplies a real account and role; and once roles exist, nav entries must be filtered by the signed-in role — an `order-manager` should not see catalog management. That filtering is a convenience, never the security boundary; the server rejects unauthorized requests regardless of what the client renders.

---

## 10. Interaction Conventions

Conventions that hold across every screen in the console. Rules specific to one feature live in that feature's doc §4.

### 10.1 Sorting

Single-column, tri-state (ascending → descending → unsorted), reflected in `aria-sort` and in the URL. Sorting resets to page 1 and leaves search and filters untouched. Only the columns named as sortable in a feature doc are sortable — a sortable-looking header that does nothing is a defect.

### 10.2 Destructive and mutating actions

- Guarded deletes show the guard's reason inline, at the row, with the blocking count and the remedy ([§7.4](#74-error-messages)). Never fail silently.
- Any control that mutates data needs a confirmation step. A status pill that flips a record's visibility on a single unconfirmed click is not acceptable; status changes go through the form or an explicit confirm.
- After a successful mutation, the affected list, the result count, and the sidebar count badges refresh together.
- **The console shows everything regardless of status.** Never filter an admin view by buyer-facing visibility — an inactive brand or an archived product stays fully usable here.

### 10.3 Escaping

Admin-entered free text — product, brand and category names among them — later renders on a public storefront. React escapes by default; do not reach for `dangerouslySetInnerHTML` with catalog data.

---

## 11. Implementation Notes

- **Where the code goes.** Each screen is a feature under `src/features/<feature>/`; `src/app/App.tsx` holds the explicit React Router route declarations and stays thin (`admin-app/AGENTS.md`). The shell — sidebar, header, theme — is itself a feature, not something each screen re-implements.
- **Data fetching.** TanStack Query for fetching, caching and invalidation; TanStack Table for the grids ([docs/architecture.md](../../architecture.md) §4.2). List queries, count badges and result counts should share cache keys so one mutation updates all three.
- **Validation.** `admin-app`'s own client-side schemas, mirroring but not importing `backend`'s — [§7.3](#73-validation-rules) and root `CLAUDE.md`.
- **Images.** Uploads go directly to R2 through a presigned URL requested from `backend` (`FR-CAT-054`–`059`); the API never receives image bytes. Forms hold local previews until save.
- **Errors.** Map the backend's `code` to copy in the UI layer — [§7.4](#74-error-messages).
- **Keeping this in sync.** When the shell or the design language changes, update this document in the same PR as the code and bump [§12](#12-version-history). When a screen changes, update its feature doc. When the SRS data model changes, the order is: SRS → these documents → `mock-ui/` → implementation.

### 11.1 Where `mock-ui` falls short

The prototype is built to these documents, so most of the old gaps are closed. What remains deliberately unbuilt there:

| Gap in the prototype                                          | Why it stays                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Nothing persists past reload except theme and sidebar state   | No backend; documented in [mock-ui/README.md](../../../mock-ui/README.md)                         |
| No real auth; the shared-secret guard isn't modelled          | Authentication is v0.3                                                                            |
| No real image upload — blob previews only                     | No R2/presign flow in a static prototype                                                          |
| Unescaped `innerHTML` interpolation                           | Safe only because the data is a hard-coded fixture; the real app escapes ([§10.3](#103-escaping)) |
| Filters and sort held in memory, not the URL                  | The real app puts them in the URL ([§5.4](#54-persistence))                                       |
| Full TanStack Table behaviour (column sizing, virtualization) | The prototype hand-rolls the minimum needed to validate the layout                                |

---

## 12. Version History

| Version | Date       | Change                                                                                 | Reflects SRS |
| ------- | ---------- | -------------------------------------------------------------------------------------- | ------------ |
| 0.1     | 2026-07-27 | Initial specification — console shell, design guidelines, components, UI feature index | v0.2         |

Bump the version whenever a normative rule in this document changes. A new feature doc does not bump it; a new row in [§9](#9-ui-feature-index) does.
