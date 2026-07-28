# buyer-app — Main UI

**Project:** TechCart
**Scope:** The storefront itself — project information, purpose, objectives, target users, layout structure, design guidelines, UI components, accessibility, the UI feature index, interaction conventions and implementation notes. Per-feature screens live in their own feature docs under `docs/ui/buyer/`
**Status:** Draft — design language and shell derived from the `mock-ui/buyer/` prototype, raised to a normative target for implementation
**Related:** [docs/ui/README.md](../README.md) (document chain, precedence, conventions); [docs/architecture.md](../../architecture.md) §4.1 (rendering strategy, client state); [admin/admin-main-ui.md](../admin/admin-main-ui.md) (admin console); [mock-ui/buyer/](../../../mock-ui/buyer/) (clickable prototype)

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

|                     |                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Application**     | `buyer-app` — the TechCart customer storefront                                                                                                |
| **Workspace**       | `buyer-app/` (npm workspace, flat at repo root)                                                                                               |
| **Shape**           | Next.js 16, App Router. Catalog listing, category and product detail render on the server (ISR); search is client-fetched                     |
| **Styling**         | Tailwind CSS 4, wired CSS-first — `@import "tailwindcss";` in `src/app/globals.css`, no `tailwind.config.js`. Default palette, no custom ramp |
| **Data**            | TanStack Query for client-side fetching and caching. Cart state (Zustand) arrives with SRS v0.4                                               |
| **API**             | The shared `backend/` Express service. No business logic lives in this app                                                                    |
| **Where code goes** | `src/features/<feature>/` per screen; `src/app/` stays thin routing only                                                                      |
| **Authorization**   | None today — the whole storefront is public in SRS v0.2. Sign-in arrives in v0.3                                                              |

Per-route rendering strategy is fixed by [docs/architecture.md](../../architecture.md) §4.1 and is not re-decided here.

Implementation-level concerns for this workspace — Tailwind wiring, TypeScript config, test setup — live in `buyer-app/docs/architecture.md` and are not repeated here.

---

## 2. Purpose

This document specifies **how the buyer storefront looks and behaves** at the whole-app level: the design language every page inherits, the shell every page sits inside, and the conventions every page follows. Individual screens are specified in feature docs.

**What this document owns:** the design language, the shell, the shared components, and the conventions every page follows. What it deliberately does not own: architecture decisions (root `docs/architecture.md`), requirements (the feature's SRS §6), and individual screens (the feature docs).

The full document chain and the precedence rules that resolve disagreements between those artifacts are stated once, for both apps, in [docs/ui/README.md](../README.md#precedence). They are not repeated here — a second copy is a second thing to keep true. One buyer-specific consequence is worth stating up front: the storefront prototype has no accessibility affordances at all, so [§11.1](#111-where-mock-ui-falls-short) lists what must not be copied forward from it.

---

## 3. Objectives

What this storefront is optimising for, in priority order. When two of these conflict, the higher one wins.

1. **Get the buyer to the right product fast.** Filters, sort and search exist to narrow; everything else is subordinate to that.
2. **Quiet by default.** Colour carries meaning — discount, stock, error — never decoration. There is no brand hue beyond near-black, and adding one is a design decision nobody has made.
3. **Every state is designed.** Loading, loaded, empty and error each have their own treatment; an empty grid is never just a grid with no rows ([§10.1](#101-the-four-render-states)).
4. **A failure never takes the page down.** Error is scoped to the region that failed; the header, nav and filters stay usable ([§10.1](#101-the-four-render-states)).
5. **A filtered view is a shareable URL.** Filter, sort and page state live in the URL so a link reproduces exactly what the sender saw ([§10.2](#102-filters-sort-and-pagination)).
6. **Nothing depends on JavaScript that shouldn't.** The search box is a plain `GET` form and navigates with JS disabled; preserve that.

---

## 4. Target Users

The two buyer-side user classes defined in [docs/srs/SRS.md](../../srs/SRS.md) §2.3. Neither is staff.

| User class           | Can                                                                             | Cannot (in SRS v0.2)                                |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Guest**            | Browse the catalog, filter, search, view any published product and its variants | Sign in, hold a cart, or check out — none exist yet |
| **Registered Buyer** | Everything a guest can                                                          | Nothing extra yet; accounts arrive with SRS v0.3    |

The two classes are indistinguishable in v0.2 because there is no authentication — the storefront is entirely public and entirely read-only. When v0.3 lands, the header gains an account affordance it does not have today.

Characteristics that shaped the design: first-time and returning visitors on mixed devices, mobile-first, short sessions, low tolerance for layout shift, and no training. Nothing on the storefront assumes prior familiarity with it.

---

## 5. Layout Structure

Every buyer page is: header → `<main>` container → (optionally) a two-column filter/content split.

```
┌───────────────────────────────────────────────────────┐
│ header — wordmark · category nav · search             │
├───────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐  │
│  │ main — mx-auto max-w-6xl px-4 py-6              │  │
│  │ ┌───────────┐ ┌───────────────────────────────┐ │  │
│  │ │ aside     │ │ section                       │ │  │
│  │ │ filters   │ │ toolbar · grid · pagination   │ │  │
│  │ │ lg:w-64   │ │ flex-1                        │ │  │
│  │ │           │ │                               │ │  │
│  │ └───────────┘ └───────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────┘  │
│                 (no footer yet — 5.4)                 │
└───────────────────────────────────────────────────────┘
```

Below `lg` the filter column stacks above the content column ([§6.4](#64-responsive-design)). The document scrolls normally — unlike the console, the storefront has no fixed shell.

### 5.1 Header

One shared header across all buyer routes:

- Wordmark on the left, linking to the catalog root.
- A `<nav>` of top-level categories — **only categories with `status: true`** (`FR-CAT-026`, Decision #13). An inactive category is absent from the nav, but its page remains reachable by URL.
- A search field, right-aligned, submitting to the search route. In the prototype this is a plain `GET` form that works with JavaScript disabled; preserve that property — the search box must not depend on client-side JS to navigate.
- The field repopulates from the current query so the term is still visible on the results page.

### 5.2 Main container

`mx-auto max-w-6xl px-4 py-6`, narrowing to `max-w-5xl` on the product detail page.

### 5.3 Filter/content split

Listing pages use `flex flex-col gap-6 lg:flex-row`: an `<aside class="w-full shrink-0 space-y-6 lg:w-64">` for filters, and a `<section class="flex-1">` for the toolbar, grid, and pagination. Below `lg` the filter column stacks above the grid.

### 5.4 Footer

There is none yet. A footer is not designed and should not be improvised — it needs its own content decisions (legal links, contact, policies) that no SRS version has made.

---

## 6. Design Guidelines

The storefront's identity is **quiet and neutral**: a near-white page, white surfaces, hairline borders, near-zero elevation, and a single near-black accent. Colour is reserved for meaning, never decoration.

Everything below is expressed in Tailwind utility classes, because Tailwind 4 is the styling layer for this workspace and the default palette is used as-is — there is no custom colour ramp to invent. This section defines the tokens; [§7](#7-ui-components) composes them into components.

### 6.1 Color Guidelines

The storefront is **light-theme only**. There is no dark mode and no theme toggle — adding one is a design decision, not a styling detail.

| Role                        | Classes                                                                                                     | Notes                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Page background / body text | `bg-neutral-50` / `text-neutral-900`                                                                        | Set once on the root layout                                           |
| Surface                     | `bg-white` + `border border-neutral-200`                                                                    | Cards, header, any raised region                                      |
| **Primary action**          | `bg-neutral-900 text-white hover:bg-neutral-700`                                                            | Buttons, submit, and the active state of pagination and facet pills   |
| Success / discount          | `bg-emerald-100 text-emerald-700`                                                                           | The `X% off` pill only                                                |
| Danger / out of stock       | `bg-red-100 text-red-700`; error panel `border-red-200 bg-red-50 text-red-700` with `text-red-500` sub-copy | Never used for anything non-negative                                  |
| Informational note          | `bg-amber-50 text-amber-700`                                                                                | Non-blocking asides                                                   |
| Muted text ladder           | `text-neutral-700` → `600` → `500` → `400`                                                                  | Section heading → label → meta → placeholder/empty. Do not skip rungs |
| Divider                     | `border-neutral-200`, `border-neutral-100` inside dense lists                                               |                                                                       |

There is intentionally **no brand hue** beyond near-black. A buyer-facing accent colour is a design decision nobody has made yet; do not introduce one ad hoc.

### 6.2 Typography

No `font-family` is declared anywhere — the storefront runs on Tailwind's default `ui-sans-serif, system-ui` stack. Introducing a webfont is a decision that needs making explicitly (it has a measurable cost against the performance NFRs reserved for SRS v0.9), not a drive-by change.

| Use                                   | Classes                                            |
| ------------------------------------- | -------------------------------------------------- |
| Page heading (`h1`)                   | `text-2xl font-semibold tracking-tight`            |
| Wordmark                              | `text-xl font-semibold tracking-tight`             |
| Card price, gallery placeholder       | `text-lg font-semibold`                            |
| Struck-through MRP                    | `text-sm text-neutral-400 line-through`            |
| Body, table, controls                 | `text-sm` — the default for essentially everything |
| Helper text, badges, breadcrumb, meta | `text-xs`                                          |

Weights are limited to `font-medium` and `font-semibold`. `font-bold` is not used on the storefront.

### 6.3 Spacing, radii and elevation

- **Container** — `mx-auto max-w-6xl px-4 py-6` for listing pages; `max-w-5xl` for the product detail page.
- **Padding** — cards `p-3` (product card) or `p-5` (larger panels); controls `px-3 py-1.5` standard, `px-2 py-1` compact, `px-2 py-0.5` for pills.
- **Rhythm** — `gap-*`/`space-y-*` on the 2/3/4/6/8 steps only.
- **Radii** — `rounded-md` for controls and buttons, `rounded-lg` for cards and panels, `rounded-full` for pills, `rounded` for small inline badges.
- **Elevation** — deliberately almost none. The only shadow in the entire storefront is `hover:shadow-md` on the product card. Depth is communicated by borders, not shadows; adding a shadow scale is a design decision, not a styling detail.

### 6.4 Responsive Design

Tailwind's default breakpoints, mobile-first. Only `sm` (640px), `md` (768px), and `lg` (1024px) are in use:

| Breakpoint | Behaviour                                                                   |
| ---------- | --------------------------------------------------------------------------- |
| base       | Filters stacked above the grid; product grid two columns; PDP single column |
| `sm`       | Product grid three columns; search field sizes to content                   |
| `md`       | PDP splits into gallery + information columns                               |
| `lg`       | Filter sidebar moves beside the grid at `w-64`                              |

The grid stays at three columns above `lg` by design. If wide-viewport density becomes a real complaint, changing it is a design decision to record here, not a per-page override.

### 6.5 Browser Support

**Not yet specified.** Browser support is a system-wide frontend non-functional requirement owned by **SRS v0.9** ([docs/srs/SRS.md](../../srs/SRS.md) §3), which has not been written.

Until v0.9 lands, the working assumption is current evergreen Chrome, Edge, Firefox and Safari. Treat that as an assumption, not a commitment: no code should depend on it, and no support claim should be made to anyone on the strength of this paragraph. When v0.9 specifies the matrix, this section is replaced by a pointer to it.

### 6.6 Icons

Inline Feather-style SVG paths, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, sized `h-5 w-5` (`h-4 w-4` when inside a control). No icon library is a dependency today. Decorative icons take `aria-hidden="true"`; an icon that is the only content of a control needs an accessible name ([§8](#8-accessibility)).

### 6.7 Why this differs from `admin-app`

`admin-app` uses an indigo accent on a dark slate shell; the storefront uses near-black on near-white. This is **intentional**, not drift: the two apps have different audiences, different session lengths, and no shared component code (there is no `packages/` directory in this repo — see [docs/architecture.md](../../architecture.md) §8). Neither app's palette is the "real" one. See [admin/admin-main-ui.md §6](../admin/admin-main-ui.md#6-design-guidelines).

---

## 7. UI Components

Components used by the shell or by more than one feature, composed from the tokens in [§6](#6-design-guidelines). A component that exists only inside one feature belongs in that feature's doc §2, not here.

### 7.1 Forms

The storefront has no data-entry forms in SRS v0.2 — only filter controls and the header search. What exists:

**Text input / select** — `rounded-md border border-neutral-300 px-3 py-1.5 text-sm` (`px-2 py-1` compact). Used for the search field, the price-range min/max pair, and the sort control.

**Rules.**

- Every field keeps its `<label>` association. A placeholder is never a substitute for a label.
- Invalid fields set `aria-invalid` and `aria-describedby` pointing at the error text ([§8](#8-accessibility)).
- The header search is a plain `GET` form and must stay one — it navigates with JavaScript disabled ([§3](#3-objectives), objective 6).

Sign-in, checkout and address forms arrive with SRS v0.3–v0.6 and are not designed here.

### 7.2 Buttons

One emphasis, one shape. All are `rounded-md` and carry a visible focus ring.

| Variant       | Classes                                          | Use                                                        |
| ------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| **Primary**   | `bg-neutral-900 text-white hover:bg-neutral-700` | Submit, and the active state of pagination and facet pills |
| **Secondary** | `border border-neutral-300 hover:bg-neutral-50`  | Clear filters, and every non-primary action                |

| Size     | Padding       | Use                                  |
| -------- | ------------- | ------------------------------------ |
| Standard | `px-3 py-1.5` | Search submit, clear filters         |
| Compact  | `px-2 py-1`   | Toolbar controls                     |
| Pill     | `px-2 py-0.5` | Facet pills, badges — `rounded-full` |

**Rules.**

- There is **no "Add to cart" control** in SRS v0.2. The page simply does not present one until v0.4 — it does not present a disabled one, and it does not explain its absence to buyers.
- An icon-only button needs an accessible name via `aria-label`; a `title` attribute is not an accessible name.
- Clicking an already-active facet pill clears it ([§7.4](#74-component-inventory)).

### 7.3 Error Messages

**The contract.** Every backend error arrives as `{ success: false, code: string, message: string }` ([docs/architecture.md](../../architecture.md) §6). Map `code` to user-facing copy in the UI layer. **Never render a raw backend `message`** into an error panel — it is a developer string, not customer-facing copy.

| Kind         | Renders as                                                                                                      | Announced as         |
| ------------ | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| Region error | Red-tinted panel in the same slot as the grid: `border-red-200 bg-red-50 text-red-700`, `text-red-500` sub-copy | `aria-live="polite"` |
| Not found    | Dashed panel with a link back to the catalog root                                                               | —                    |
| Empty result | Dashed panel, `py-16`, centred — a designed state, not an error                                                 | `aria-live="polite"` |
| Field error  | `text-xs` danger text beneath the control; field gets `aria-invalid` + `aria-describedby`                       | —                    |

**Rules.**

- **Errors are non-blocking and scoped.** A failed product fetch must not take down the header, the nav, or the filters ([§3](#3-objectives), objective 4).
- An empty result is not an error. It is a designed state with its own copy, and where two empty cases are distinguishable they get two messages — "no keyword entered yet" is not "no results for that keyword".
- Colour is never the only carrier — an error says so in words, not merely in red.

### 7.4 Component inventory

Forms and buttons are specified above; this table covers the rest.

| Component   | Spec                                                                                                                                                     | Used on           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Pagination  | Numbered buttons only — no prev/next, no ellipsis. Hidden entirely when there is one page. Active page is `bg-neutral-900 text-white`                    | All listing pages |
| Breadcrumb  | A real `<nav>`, `/`-separated, `text-sm text-neutral-500`; the current page is plain text, not a link. Max two levels, matching the category depth limit | Category, detail  |
| Skeleton    | `animate-pulse` neutral blocks in the same grid shape as the real content, so the layout does not jump on load                                           | All listing pages |
| Empty state | Dashed-border panel, `py-16`, centred: a `text-sm font-medium text-neutral-600` message plus a `text-xs text-neutral-400` suggestion                     | All listing pages |
| Error state | Red-tinted panel in the same slot as the grid. **Non-blocking** — the header, filters, and the rest of the page stay usable                              | All listing pages |

No modal, drawer, toast, tab, or accordion pattern exists on the storefront yet. If a feature needs one, it is a design decision to make deliberately — not to improvise at the call site.

---

## 8. Accessibility

**These are requirements for `buyer-app`, not descriptions of the prototype.** SRS v0.9 will specify system-wide frontend NFRs; until it lands, this section is the bar.

- Every interactive element has a visible focus indicator. `focus:outline-none` is only acceptable when paired with a replacement ring in the same class list.
- Icon-only controls carry an accessible name via `aria-label`. A `title` attribute is not an accessible name.
- The active nav item and the current pagination page are marked `aria-current`.
- Result counts and any region that swaps in new async content are announced — `aria-live="polite"` on the count, so filtering and searching are perceivable without sight of the grid.
- Filter facets and the variant selector are fully keyboard-operable, with selection state exposed (`aria-pressed` for toggles, or native radio/checkbox semantics — do not fake either with a `<div>`).
- Breadcrumbs are a `<nav>` with an accessible name.
- Real images carry meaningful `alt`; decorative SVG carries `aria-hidden="true"`.
- Form fields keep their `<label>` association, and invalid fields set `aria-invalid` plus `aria-describedby` pointing at the error text.
- Colour is never the only carrier of meaning — the stock badge says "Out of stock", it is not merely red.

---

## 9. UI Feature Index

Every buyer-facing area, keyed to [docs/srs/SRS.md](../../srs/SRS.md) §3.

The feature ↔ SRS ↔ UI-doc mapping is maintained once, in [docs/ui/README.md](../README.md#feature-status). This table adds only what is specific to the storefront: the rendering strategy each area uses.

| Area                    | SRS version | Rendering, fixed by [docs/architecture.md](../../architecture.md) §4.1 |
| ----------------------- | ----------- | ---------------------------------------------------------------------- |
| Product Catalog         | v0.2        | ISR, except search (client-fetched)                                    |
| Home page               | —           | ISR                                                                    |
| Sign in / register      | v0.3        | —                                                                      |
| Cart                    | v0.4        | Client-rendered                                                        |
| Checkout                | v0.5 / v0.6 | Client-rendered, no caching                                            |
| Account / order history | v0.5        | Client-rendered, session-gated                                         |
| Buyer dashboard         | v0.7        | Client-rendered, session-gated                                         |

No screens are designed for the areas without a UI doc, and none should be invented here. Unlike the console — which renders its unspecified features as visible disabled nav entries — the storefront renders nothing at all for them. Each gets a feature doc when its SRS version is written and reviewed; follow [docs/ui/README.md](../README.md#adding-a-features-ui-doc).

Two consequences worth planning around now: the header will need an account/cart affordance it does not have today, and the product detail page gains its "Add to cart" control in v0.4 (`FR-CAT-051`'s variant selection is what that control will read from).

---

## 10. Interaction Conventions

Conventions that hold across every storefront page. Rules specific to one feature live in that feature's doc §4.

### 10.1 The four render states

Every asynchronous region resolves to exactly one of: **loading**, **loaded**, **empty**, **error**. Rules:

- Loading renders a skeleton in the shape of the eventual content, never a spinner and never a collapsed container.
- Empty is a designed state with its own copy, never a zero-row grid.
- Error is scoped to the region that failed and is **non-blocking** — a failed product fetch must not take down the header, the nav, or the filters.
- The states are per-region, not per-page. A page with two independent fetches has two independent state machines.

### 10.2 Filters, sort, and pagination

- Any change to a filter or the sort order resets to page 1. Changing the page does not touch the filters.
- Changing the page scrolls the results region back into view.
- Filter state belongs in the URL so a filtered listing is linkable, shareable, and survives a reload. The prototype keeps it in memory only; that is a prototype limitation, not the target.
- Clearing filters resets the filter values, the page number, and the visible active states in one action.

### 10.3 Escaping

All product, brand, and category names are admin-supplied text rendered on a public page. React escapes by default — do not reach for `dangerouslySetInnerHTML` to render catalog data. (The prototype interpolates unescaped strings into `innerHTML` throughout; that is safe only because its data is a hard-coded fixture.)

---

## 11. Implementation Notes

- **Where the code goes.** Each screen is a feature under `src/features/<feature>/`; `src/app/` stays thin routing only. This is `buyer-app`'s existing convention — see `buyer-app/AGENTS.md`.
- **Server vs client.** Catalog listing, category, and product detail render on the server (ISR) and should fetch in Server Components. The interactive parts — filter controls, sort, pagination, variant selector, search results — are Client Components. Keep the client boundary as low in the tree as it will go.
- **Data fetching.** TanStack Query for client-side fetching and caching ([docs/architecture.md](../../architecture.md) §4.1). Cart state (Zustand, `localStorage`-persisted for guests) arrives with v0.4 and is out of scope here.
- **Design tokens.** When the values in [§6](#6-design-guidelines) start repeating across features, promote them to an `@theme` block in `src/app/globals.css` rather than adding a config file or a second source of truth.
- **Validation.** Any client-side validation is `buyer-app`'s own, for UX only. It is not shared with `backend` and is not what enforces correctness — see root `CLAUDE.md`, "No shared validation package."
- **Errors.** Map the backend's `code` to user-facing copy in the UI layer — [§7.3](#73-error-messages).
- **Keeping this in sync.** When the shell or the design language changes, update this document in the same PR as the code and bump [§12](#12-version-history). When a screen changes, update its feature doc. When the SRS data model changes, the order is: SRS → these documents → `mock-ui/` → implementation.

### 11.1 Where `mock-ui` falls short

Do not copy these forward:

| Gap in the prototype                                            | What `buyer-app` must do instead                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Zero `aria-*` attributes anywhere in the whole prototype        | [§8](#8-accessibility) in full                                      |
| Search input uses `focus:outline-none` with no replacement ring | Visible `focus-visible` ring on every interactive element           |
| Result counts and grid swaps are silent to assistive technology | `aria-live="polite"` on the count and async regions                 |
| Breadcrumbs are `<nav>` on buyer pages but decoration elsewhere | Always a `<nav>` with an accessible name                            |
| Unescaped `innerHTML` interpolation of catalog data             | Escaped rendering ([§10.3](#103-escaping))                          |
| Filter state is in-memory only                                  | Filter state in the URL ([§10.2](#102-filters-sort-and-pagination)) |

---

## 12. Version History

| Version | Date       | Change                                                                                    | Reflects SRS |
| ------- | ---------- | ----------------------------------------------------------------------------------------- | ------------ |
| 0.1     | 2026-07-27 | Initial specification — storefront shell, design guidelines, components, UI feature index | v0.2         |

Bump the version whenever a normative rule in this document changes. A new feature doc does not bump it; a new row in [§9](#9-ui-feature-index) does.
