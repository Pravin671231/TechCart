# admin-app — Product Catalog UI

**Project:** TechCart
**Feature:** Product Catalog (SRS v0.2, feature code `CAT`)
**Scope:** The five catalog screens in the admin console — product list, product preview, the create/edit wizard, categories, brands. The console shell, design guidelines and shared components they sit inside are specified once in the main doc
**Status:** Draft — normative target for implementation; `mock-ui/admin/` is built to match it
**Related:** [admin/admin-main-ui.md](admin-main-ui.md) (design guidelines, layout, shared components, conventions); [docs/srs/features/0.2-product-catalog.md](../../srs/features/0.2-product-catalog.md) §6 (the requirements these screens realize); [buyer/product-catalog.md](../buyer/product-catalog.md) (the same feature, storefront side); [mock-ui/admin/](../../../mock-ui/admin/) (clickable prototype)

Product Catalog is the only feature with a specified admin UI. It supplies the console's landing screen and everything reachable from the **Product Catalog** nav group: the three managed record types and the flows that create and edit them. `docs/srs/features/0.2-product-catalog.md` §6 owns _what_ these screens must let an admin do; this document owns _how_ they look and behave.

---

## Contents

1. [Pages](#1-pages)
2. [UI Design Details](#2-ui-design-details)
3. [Page-by-page Wireframes](#3-page-by-page-wireframes)
4. [UI Behavior and Interactions](#4-ui-behavior-and-interactions)
5. [Requirements Traceability](#5-requirements-traceability)

---

## 1. Pages

| Route                                 | Page                                | Purpose                                                   | Requirements                                                                                                | Wireframe                                         |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/products`                           | Product list                        | The console's landing screen; every product, every status | `FR-CAT-016`, `017`                                                                                         | [§3.1](#31-product-list)                          |
| `/products/:id`                       | Product preview                     | Read-only view of every field at any status               | `FR-CAT-068`, `047`, `050`                                                                                  | [§3.2](#32-product-preview)                       |
| `/products/new`, `/products/:id/edit` | Product wizard                      | Create or edit a product across four gated steps          | `FR-CAT-011`–`015`, `018`–`020`, `028`, `029`, `039`, `041`, `043`, `046`–`050`, `061`, `062`, `066`, `067` | [§3.3](#33-product-wizard)                        |
| `/categories`                         | Category list + variant-type editor | Manage the two-level category tree and its variant types  | `FR-CAT-021`–`025`, `063`, `064`, `066`, `067`                                                              | [§3.4](#34-category-list-and-variant-type-editor) |
| `/brands`                             | Brand list                          | Manage brands and their buyer-facing visibility           | `FR-CAT-033`–`037`, `065`                                                                                   | [§3.5](#35-brand-list)                            |

All five sit inside the console shell ([admin-main-ui.md §5](admin-main-ui.md#5-layout-structure)) and behind the admin role gate ([admin-main-ui.md §1](admin-main-ui.md#1-project-information)).

---

## 2. UI Design Details

### What this feature brings

| Surface                       | Count | Notes                                                                                    |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| **Data tables**               | 3     | Products (9 columns), Categories (5), Brands (5) — all sortable, paginated, full-width   |
| **Nested table**              | 1     | The variants table inside the product preview — read-only, lists inactive variants too   |
| **Multi-step wizard**         | 1     | Four steps, one form model, a single save. Serves both create and edit                   |
| **Read-only detail view**     | 1     | Product preview — deliberately distinct from the wizard                                  |
| **List-plus-side-form pages** | 2     | Categories and Brands. Editing uses a persistent side panel, never a modal               |
| **Nested sub-editor**         | 1     | The variant-type editor, a second card on the category page, visible only while editing  |
| **Count badges**              | 3     | Products / Categories / Brands, in the sidebar nav group, sharing the lists' query cache |

### Components this feature introduces

Shell and multi-feature components — data table, sortable column header, pagination, status pill, empty state, forms, buttons — are in [admin-main-ui.md §7](admin-main-ui.md#7-ui-components).

| Component              | Spec                                                                                                                                                                                                   | Used on            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| Row title link         | The primary identifying cell (product name) is a link to that record's preview page. The rest of the row is not clickable — a whole-row click target swallows text selection and hides the destination | Product list       |
| Wizard stepper         | Four numbered steps with labels and a current/complete/upcoming state each. Completed steps are clickable; upcoming ones are not. Announces the step change                                            | Product wizard     |
| Step footer            | Back / Next on steps 1–3; Back / Save on step 4. Next is blocked by step validation ([§4.1](#41-wizard-rules)), and the reason is shown at the field, not only on the button                           | Product wizard     |
| Preview summary panel  | Read-only grouped summary of everything captured in the wizard, each group with a control returning to the step that owns it                                                                           | Wizard step 4      |
| List-plus-side-form    | `grid lg:grid-cols-3` — table in `lg:col-span-2`, form card beside it. **Editing uses this persistent side panel, never a modal**                                                                      | Categories, Brands |
| Computed field         | Disabled input, visibly not editable. Used for `sellingPrice`, which is server-computed (`FR-CAT-062`) and never accepted from the client                                                              | Wizard steps 1, 3  |
| Inline guard error     | Full-width error row beneath the offending table row, stating the blocking count and the remedy                                                                                                        | Categories, Brands |
| Image picker           | File input limited to JPEG/PNG/WebP with thumbnail previews and the count bound surfaced inline (1–8 per product, 1–2 per variant)                                                                     | Wizard steps 2, 3  |
| Repeatable variant row | Bordered block: active toggle, remove, SKU / MRP / discount / computed selling price / stock / optional weight, attributes, optional 0–2 images                                                        | Wizard step 3      |
| Dynamic spec fields    | Rendered from the selected category's `specificationGroups`; input type follows the declared type; unit appended to the label                                                                          | Wizard step 2      |

---

## 3. Page-by-page Wireframes

Wireframes show regions and reading order, not pixel-accurate widths — see [docs/ui/README.md](../README.md#wireframes). Each sits inside the shell of [admin-main-ui.md §5](admin-main-ui.md#5-layout-structure); only the `<main>` region is drawn.

### 3.1 Product list

```
┌───────────────────────────────────────────────────────────┐
│ Products                                    ← breadcrumb  │
│                                                           │
│ Products                              [ + New product ]   │
│                                                           │
│ ┌────────────────────┐ ┌────────────┐    ← filters        │
│ │ Search…            │ │ Status  ▾  │                     │
│ └────────────────────┘ └────────────┘                     │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │Img│Name  ↕│SKU  ↕│Brand ↕│Price  ↕│Stk ↕│Sts  ↕│Actn  │ │
│ ├───────────────────────────────────────────────────────┤ │
│ │ ▢ │Kai…   │K-101 │Acme   │From ₹… │  0  │ pub  │Edit  │ │
│ │   │3 variants                                         │ │
│ ├───────────────────────────────────────────────────────┤ │
│ │ ▢ │Nova…  │N-220 │Orbit  │  ₹…    │ 42  │draft │Edit  │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│                                       ‹ 1  2  3 ›         │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/products` — the console's landing screen.
- **Regions:** breadcrumb → title row with **+ New product** → search + status filter → table → pagination.
- **Columns:** Image, Name, SKU, Brand, Category, Price, Stock, Status, actions.
  - **Name** is the link to the preview ([§3.2](#32-product-preview)) and carries a "N variants" sub-line when the product has variants.
  - **Price** is prefixed `From ` when variant-derived (`FR-CAT-050`); **Stock** renders in danger colour at zero.
  - **Sortable:** Name, SKU, Brand, Category, Price, Stock, Status. **Not sortable:** Image, actions.
  - Sort is single-column, tri-state (asc → desc → unsorted), and lives in the URL ([admin-main-ui.md §5.4](admin-main-ui.md#54-persistence), [§10.1](admin-main-ui.md#101-sorting)).
- **Shows every status** — draft, published and archived are all listed, unlike any buyer-facing endpoint (`FR-CAT-017`).
- **States:** loading, loaded, empty ("No products match this search/filter."), error.
- **Requirements:** `FR-CAT-016`, `017`.

### 3.2 Product preview

```
┌───────────────────────────────────────────────────────────┐
│ Products / Kai Wireless Headphones          ← breadcrumb  │
│                                                           │
│ Kai Wireless Headphones   [published]        [  Edit  ]   │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Basic info                                            │ │
│ │ SKU      K-101        Brand     Acme                  │ │
│ │ Category Audio        Slug      kai-wireless…         │ │
│ │ Description  …                                        │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Price & stock    ⓘ starting from — active variants    │ │
│ │ MRP ₹…   Discount …%   Selling ₹…   Stock …           │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Images    ▢ ▢ ▢ ▢                                     │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Specifications                                        │ │
│ │ ▸ Audio      Driver size  40 mm                       │ │
│ │ ▸ Battery    Playback     30 h                        │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Variants                                              │ │
│ │ SKU │Attributes│MRP│Disc│Selling│Stk│Wt│Img│Status    │ │
│ │ …   │Black / M │…  │…   │…      │…  │… │▢  │active    │ │
│ │ …   │White / M │…  │…   │…      │…  │… │▢  │inactive  │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/products/:id`. Reached from the product-list name link and from wizard step 4.
- A read-only view of every field at any status, deliberately distinct from the create/edit wizard (`FR-CAT-068`). Header row carries breadcrumb, product name, status pill, and an **Edit** action that opens the wizard.
- **Sections:** Basic info (SKU, brand, category, slug, description), Price & stock (with the "starting from" note when active variants exist), Images, Specifications (grouped), Variants.
- The Variants table lists **every** variant including inactive ones — SKU, Attributes, MRP, Discount, Selling price, Stock, Weight, Images, Status — with an explicit empty case for products that sell via their own SKU.
- Field/value pairs use `<dl>`/`<dt>`/`<dd>`, not a table.
- **States:** loaded, not found.
- **Requirements:** `FR-CAT-068`, plus `FR-CAT-047`/`050` for variant display.

### 3.3 Product wizard

The frame is the same on every step: a stepper across the top, one step body visible at a time, a step footer beneath.

```
┌───────────────────────────────────────────────────────────┐
│ Products / New product                      ← breadcrumb  │
│                                                           │
│ New product                                               │
│                                                           │
│ ①━━━━━━━━━━②───────────③───────────④                      │
│ Basic      Images &    Add         Preview                │
│ Information Specs      Variants                           │
│                                                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │              step body — see below                    │ │
│ │                                                       │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [ Back ]                                     [  Next  ]   │
└───────────────────────────────────────────────────────────┘
```

**Step 1 — Basic Information**

```
┌───────────────────────────────────────────────────────────┐
│ Basic information                                         │
│ ┌─────────────────────────┐ ┌─────────────────────────┐   │
│ │ Name *                  │ │ SKU *                   │   │
│ └─────────────────────────┘ └─────────────────────────┘   │
│ ┌─────────────────────────┐ ┌─────────────────────────┐   │
│ │ Brand *            ▾    │ │ Category *         ▾    │   │
│ └─────────────────────────┘ └─────────────────────────┘   │
│ ┌─────────────────────────┐                               │
│ │ Status             ▾    │                               │
│ └─────────────────────────┘                               │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Description                                           │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ Price & stock                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ MRP ₹ *  │ │ Disc % * │ │ Selling  │ │ Stock *  │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                            ↑ computed, never editable     │
└───────────────────────────────────────────────────────────┘
```

**Step 2 — Images and Specifications**

```
┌───────────────────────────────────────────────────────────┐
│ Images                              1–8 · JPEG/PNG/WebP   │
│ [ Choose files ]                                          │
│  ▢ ✕   ▢ ✕   ▢ ✕   ▢ ✕                                    │
│                                                           │
│ Specifications         rendered from the step-1 category  │
│ ▸ Audio                                                   │
│   ┌──────────────────────┐ ┌──────────────────────┐       │
│   │ Driver size (mm) *   │ │ Impedance (Ω)        │       │
│   └──────────────────────┘ └──────────────────────┘       │
│ ▸ Battery                                                 │
│   ┌──────────────────────┐                                │
│   │ Playback (h) *       │                                │
│   └──────────────────────┘                                │
└───────────────────────────────────────────────────────────┘
```

**Step 3 — Add Variants**

```
┌───────────────────────────────────────────────────────────┐
│ Variants                               [ + Add variant ]  │
│ ⓘ With one or more variants, step 1's price and stock     │
│   become "starting from" values.                          │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Variant 1                    [ Active ▣ ]       [ ✕ ] │ │
│ │ ┌────────┐┌────────┐┌────────┐┌─────────┐             │ │
│ │ │ SKU *  ││ MRP ₹ *││ Disc % ││ Selling ││ ← computed │ │
│ │ └────────┘└────────┘└────────┘└─────────┘             │ │
│ │ ┌────────┐┌────────┐                                  │ │
│ │ │Stock * ││ Weight │                                  │ │
│ │ └────────┘└────────┘                                  │ │
│ │ Attributes   ┌──────────┐ ┌──────────┐                │ │
│ │              │ Color  ▾ │ │ Size   ▾ │                │ │
│ │              └──────────┘ └──────────┘                │ │
│ │ Images (0–2)   ▢ ✕   ▢ ✕                              │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Variant 2                                        …    │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**Step 4 — Preview**

```
┌───────────────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Basic information                       [ Edit → 1 ]  │ │
│ │ Name … SKU … Brand … Category … Status … MRP … Stock  │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Images and specifications               [ Edit → 2 ]  │ │
│ │ ▢ ▢ ▢    Audio: Driver size 40 mm  …                  │ │
│ └───────────────────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Variants                                [ Edit → 3 ]  │ │
│ │ 2 variants — Black / M, White / M                     │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ [ Back ]                                 [ Save product ] │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/products/new` and `/products/:id/edit`. Same wizard; the heading and the final action differ by mode.

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

### 3.4 Category list and variant-type editor

```
┌───────────────────────────────────────────────────────────┐
│ Categories                                  ← breadcrumb  │
│                                                           │
│ Categories                           [ + New category ]   │
│                                                           │
│ ┌───────────────────────────────┐ ┌─────────────────────┐ │
│ │Name ↕ │Parent ↕│Prod ↕│Sts ↕│⋯│ │ Edit category       │ │
│ ├───────────────────────────────┤ │ ┌─────────────────┐ │ │
│ │Audio  │  —     │  12  │ ▣   │E│ │ │ Name *          │ │ │
│ ├───────────────────────────────┤ │ └─────────────────┘ │ │
│ │Headset│ Audio  │   5  │ ▣   │E│ │ ┌─────────────────┐ │ │
│ ├───────────────────────────────┤ │ │ Parent      ▾   │ │ │
│ │⚠ Cannot delete: 5 products,   │ │ └─────────────────┘ │ │
│ │  2 subcategories.             │ │ [ Nav image ]       │ │
│ ├───────────────────────────────┤ │ ▣ Active — shown    │ │
│ │Cables │ Audio  │   0  │ ▢   │E│ │   to buyers         │ │
│ └───────────────────────────────┘ │ [Save]  [Cancel]    │ │
│          lg:col-span-2            └─────────────────────┘ │
│                                   ┌─────────────────────┐ │
│                                   │ Variant types       │ │
│                                   │ (while editing only)│ │
│                                   │ Name / Code /       │ │
│                                   │ Type ▾ / Required   │ │
│                                   │ Options             │ │
│                                   │  Label:value, …     │ │
│                                   │ ⓘ UI hint only —    │ │
│                                   │   not enforced      │ │
│                                   └─────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/categories`. Breadcrumb → title row with **+ New category** → list-plus-side-form.
- **Columns:** Name, Parent, Products, Status, actions. Sortable: Name, Parent, Products, Status.
- **Category form:** Name, Parent category (optional; only top-level categories offered, never itself — the hierarchy is capped at two levels), Nav image (optional), an Active checkbox labelled for its effect, Save, Cancel edit.
- **Delete guard:** blocked while the category has any products or subcategories, with an inline error naming both counts. A successful delete cascades to that category's specification and variant-type definitions (`FR-CAT-024`).
- **Variant-type editor:** a second card, visible only while editing an existing category. Fields: Name, Code, Type (`select`/`color`/`text`/`number`), a Required flag that is **explicitly a UI hint only**, and an options list for `select`/`color` entered as `Label:value` pairs. Removing a variant type is **never** blocked — these definitions only drive the wizard's step-3 rendering and are not validated server-side (`FR-CAT-066`, `067`). The helper text says so, so nobody reads the missing guard as a bug.
- **Requirements:** `FR-CAT-021`–`025`, `063`, `064`, `066`, `067`.

### 3.5 Brand list

```
┌───────────────────────────────────────────────────────────┐
│ Brands                                      ← breadcrumb  │
│                                                           │
│ Brands                                  [ + New brand ]   │
│                                                           │
│ ┌───────────────────────────────┐ ┌─────────────────────┐ │
│ │Logo│Name ↕│Products (all      │ │ Edit brand          │ │
│ │    │      │statuses) ↕│Sts ↕│⋯│ │ ┌─────────────────┐ │ │
│ ├───────────────────────────────┤ │ │ Name *          │ │ │
│ │ ▢  │Acme  │    12     │ ▣   │E│ │ └─────────────────┘ │ │
│ ├───────────────────────────────┤ │ ┌─────────────────┐ │ │
│ │⚠ Cannot delete: 12 products.  │ │ │ Description     │ │ │
│ ├───────────────────────────────┤ │ └─────────────────┘ │ │
│ │ ▢  │Orbit │     0     │ ▢   │E│ │ [ Logo ]            │ │
│ └───────────────────────────────┘ │ ▣ Active — shown    │ │
│          lg:col-span-2            │   to buyers         │ │
│                                   │ [Save]  [Cancel]    │ │
│                                   └─────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

- **Route:** `/brands`. Breadcrumb → title row with **+ New brand** → list-plus-side-form.
- **Columns:** Logo, Name, "Products (all statuses)", Status, actions. Sortable: Name, Products, Status.
- The column header states "all statuses" deliberately — the count governing the delete guard includes draft and archived products (`FR-CAT-036`), so a brand can look unused on the storefront and still be undeletable.
- **Brand form:** Name, Description (optional), Logo (optional), an Active checkbox labelled for its effect, Save, Cancel edit.
- **Requirements:** `FR-CAT-033`–`037`, `065`.

---

## 4. UI Behavior and Interactions

Rules specific to Product Catalog. Console-wide conventions — sorting, destructive actions, escaping — are in [admin-main-ui.md §10](admin-main-ui.md#10-interaction-conventions); validation and error rendering are in [§7.3](admin-main-ui.md#73-validation-rules) and [§7.4](admin-main-ui.md#74-error-messages).

### 4.1 Wizard rules

- **Forward is gated, backward is free.** Advancing runs the current step's validation; returning to a completed step never does. A completed step is reachable from the stepper; an unvisited one is not.
- **The step footer explains itself.** When Next is blocked, the reason appears at the offending field — a disabled button with no explanation is a dead end.
- **Step 4 is read-only.** Edits happen by returning to the owning step, not inline in the preview.
- **Save happens once**, at step 4. There is no autosave and no partial record.
- **Leaving is destructive and must be warned about**, in both create and edit mode.

### 4.2 Prices

MRP and discount are entered; **selling price is never entered**. It is computed as `mrp - floor(mrp * discount / 100)` server-side on every write (`FR-CAT-062`) and shown live in a disabled field as the admin types. Prices are stored as integer paise and displayed as `₹` with `en-IN` grouping (`FR-CAT-018`); discount is an integer 0–99 (`FR-CAT-061`). The same rules apply per variant (`FR-CAT-049`).

### 4.3 Status and visibility

- Product status is a three-state lifecycle: `draft`, `published`, `archived`. Deleting a product sets `archived`; nothing is hard-deleted (`FR-CAT-016`).
- Brand and category `status` is a boolean controlling buyer-facing visibility only (`FR-CAT-063`, `065`). It does **not** bypass the delete guards (`FR-CAT-024`, `036`), and inactive records stay fully usable inside the console.
- The console shows everything regardless of status. Never filter admin views by buyer-facing visibility.

### 4.4 Wizard state in code

Held in one form model across all four steps so step 4 can render a preview without refetching, and so a category change in step 1 can invalidate step 2's spec values deliberately ([§3.3](#33-product-wizard)).

---

## 5. Requirements Traceability

Where each `FR-CAT-` requirement cited by this document is realized. IDs the SRS assigns to backend-only concerns — image upload mechanics `054`–`059`, the temporary access-control header `030`–`032` — are not screens, and are noted in [admin-main-ui.md §1](admin-main-ui.md#1-project-information) and [§11](admin-main-ui.md#11-implementation-notes) instead.

| Requirement         | Realized by                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `FR-CAT-011`–`015`  | Product wizard [§3.3](#33-product-wizard) — create/edit, unique SKU                                                      |
| `FR-CAT-016`        | Product list [§3.1](#31-product-list); archive-on-delete [§4.3](#43-status-and-visibility)                               |
| `FR-CAT-017`        | Product list [§3.1](#31-product-list) — all statuses shown                                                               |
| `FR-CAT-018`        | Prices [§4.2](#42-prices) — paise storage, `en-IN` display                                                               |
| `FR-CAT-019`, `020` | Product wizard [§3.3](#33-product-wizard) step 1 — stock field and its validation                                        |
| `FR-CAT-021`–`025`  | Category list [§3.4](#34-category-list-and-variant-type-editor), incl. delete guard + cascade                            |
| `FR-CAT-028`, `029` | Image picker [§2](#2-ui-design-details); wizard step 2 [§3.3](#33-product-wizard)                                        |
| `FR-CAT-033`–`037`  | Brand list [§3.5](#35-brand-list), incl. all-statuses count guard                                                        |
| `FR-CAT-039`        | Product wizard [§3.3](#33-product-wizard) step 1 — brand required                                                        |
| `FR-CAT-041`        | Dynamic spec fields [§2](#2-ui-design-details) — rendered from the category's groups                                     |
| `FR-CAT-043`        | Dynamic spec fields [§2](#2-ui-design-details); wizard step 2 [§3.3](#33-product-wizard)                                 |
| `FR-CAT-046`–`049`  | Repeatable variant row [§2](#2-ui-design-details); wizard step 3 [§3.3](#33-product-wizard)                              |
| `FR-CAT-047`, `050` | Product preview [§3.2](#32-product-preview); "From …" pricing [§3.1](#31-product-list)                                   |
| `FR-CAT-061`, `062` | Computed field [§2](#2-ui-design-details); prices [§4.2](#42-prices)                                                     |
| `FR-CAT-063`, `064` | Category list [§3.4](#34-category-list-and-variant-type-editor); status and visibility [§4.3](#43-status-and-visibility) |
| `FR-CAT-065`        | Brand list [§3.5](#35-brand-list); status and visibility [§4.3](#43-status-and-visibility)                               |
| `FR-CAT-066`, `067` | Variant-type editor [§3.4](#34-category-list-and-variant-type-editor) — UI hint only                                     |
| `FR-CAT-068`        | Product preview [§3.2](#32-product-preview)                                                                              |
