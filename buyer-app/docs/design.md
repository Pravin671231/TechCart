# buyer-app — design.md (color + Flipkart-style patterns)

This doc records the first color/visual-identity decision for `mock-ui/buyer-app/*.html`. Before
this pass, every file was pure grayscale (`neutral-*` only) — same blank-slate state `admin-app`
was in before its own color pass, confirmed via `buyer-app/src/app/globals.css`, still just
`@import "tailwindcss";`, no `@theme` block, no custom tokens. `buyer-app/src/` has no real
components yet beyond the placeholder home route, so there's nothing in real code to update
alongside this — same situation as `admin-app` when its `docs/design.md` was created.

## Why

The user asked for a Flipkart-style visual language — a natural fit given root `CLAUDE.md`'s
"Target market is India-first (Razorpay)" framing — with the banner/hero section explicitly
excluded (none exists in any of the 5 files today, so this is a constraint on new work, not a
removal).

**What "Flipkart-style" means here**: the layout/card/badge *patterns* common to that kind of
marketplace UI — compact bordered product cards, a strikethrough-MRP + discount-tag price
treatment, colored stock-availability badges, active-tab/sort underlines, a colored sticky header
with a prominent white search field — not Flipkart's own blue/yellow brand identity. Per explicit
correction from the user, the color palette itself **reuses `admin-app`'s exact values** rather
than introducing a new blue, so the whole TechCart product suite (buyer storefront + admin
console) shares one color language.

## Colors (identical to `admin-app/docs/design.md`)

| Role                    | Tailwind class                                            | Used for |
| ------------------------ | ----------------------------------------------------------- | ---------- |
| Primary / Success           | `green-600` (hover `green-700`, tag/badge bg `green-50`/text `green-700`) | Header background, primary links, active nav/sort/tab state, pagination active page, "X% off" discount tag, "In Stock" availability badge |
| Warning / low-stock          | `amber-600` (badge bg `amber-50`/text `amber-700`)             | "Only a few left" availability badge (not yet demonstrated in the mocks — only "In Stock" and "Out of Stock" have example data today) |
| Danger / out-of-stock          | `red-600` (badge bg `red-50`/text `red-700`)                    | "Out of Stock" badge (shown on one `home.html` card) |
| Neutral                        | `neutral-*` (unaliased)                                          | Chrome, borders, body text, strikethrough MRP (`neutral-400`) |

Same technical constraint as `admin-app`: these are CDN-Tailwind files (`@tailwindcss/browser@4`,
no build step, no shared config across files, and no shared token file *between* `buyer-app` and
`admin-app` either) — raw color classes are used directly, not custom aliases. The match between
the two apps' palettes is a deliberate, independently-applied choice, documented here so it reads
as intentional rather than coincidental.

## SRS guardrails — what this pass deliberately does NOT add

Checked against `docs/srs/features/0.2-product-catalog.md` §6/§7 before applying any Flipkart-style
pattern, so the redesign doesn't visually imply features that don't exist:

- **No wishlist, star ratings/reviews, or "related products"** — permanently out of scope (§7), not
  merely deferred.
- **No add-to-cart control, no cart icon in the header** — `product-detail.html` already carries an
  explicit "no add-to-cart in this version" notice (cart lands in v0.4); adding a cart icon now
  would visually imply a decision that hasn't been made.
- **No banner/deal/campaign entity** — doesn't exist in the SRS. The only discount concept is the
  existing per-product `discount` field (0–99% off `mrp`); this pass extends the strikethrough-MRP
  + green discount-tag treatment (already present on one `home.html` card) to every card that has a
  discount value, rather than inventing a promotional concept.
- **Card contracts stay as speced**: home/search cards = image + name + price (+ discount);
  category cards additionally show up to 4 filterable spec pairs (`FR-CAT-092`); only the
  product-detail page carries the 3-state availability badge (`FR-CAT-095`, `096`).

## Patterns applied

- **Header** (`home.html`, `category.html`, `search.html`, `product-detail.html`): `bg-green-600`.
  Superseded by the marketplace-style layout in "Header pattern" below.
- **Product cards**: `rounded-lg border border-neutral-200`, `overflow-hidden` (so square image
  placeholders clip to the rounded corner), real `hover:border-green-300` transition (pure CSS, no
  JS). Bold `text-neutral-900` selling price; where a discount exists, `text-neutral-400
  line-through` MRP + `rounded-full bg-green-50 text-green-700` discount tag.
- **Filters** (`category.html`, `search.html`): checked-looking (☑) list items get
  `text-green-700 font-medium`; filter group containers get `rounded-lg border-neutral-200`.
- **Sort controls**: active tab (`category.html`) gets a `border-b-2 border-green-600
  text-green-700` underline; dropdown-look controls get `rounded-md border-neutral-300`.
- **Pagination** (`home.html`, `category.html`): active page `bg-green-600 text-white`, identical
  treatment to `admin-app`'s `product-list.html` pagination.
- **Availability badge** (`product-detail.html`): `rounded-full bg-green-50 text-green-700` for "In
  stock" — the only state with example data in the mock today; amber/red are reserved per the
  Colors table above for "Only a few left" / "Out of Stock" when those states get their own example.
- **Variant selectors** (`product-detail.html`): active colour swatch / storage pill gets a
  `border-2 border-green-600` selection ring instead of neutral.
- **Radius**: adopts the same scale as `admin-app` — `rounded-md` inputs/small boxes, `rounded-lg`
  cards/sections/tables, `rounded-full` badges/pills. Sharp corners are gone from these mocks too.
- **Hairline borders**: `border-neutral-400` → `border-neutral-200`/`-300` throughout, matching
  `admin-app`'s "borders over shadows, hairline not heavy" convention.
- **`index.html`** (the abstract shell placeholder, not a real page): header block only →
  `bg-green-600` with white label; footer/content placeholders stay neutral since there's no real
  content to recolor.

## Header pattern

A second reference (a "TOOFAN"-branded marketplace header) drove a follow-up pass replacing the
header's search-box + text-nav-links content on `home.html`, `category.html`, `search.html`, and
`product-detail.html` (not `index.html` — its header stays the light-touch placeholder from the
color pass). Layout adopted, not the reference's purple/dark color identity (stays green, per the
same reasoning as the palette section above):

- **"☰ All Categories ▾" button** — a real `<a href="./category.html">`, `rounded-md bg-green-700`,
  hidden below `md`.
- **Search bar** — white `rounded-full` pill: the placeholder/query text (unchanged per file —
  `search.html` keeps its filled `smartphon` example), a visual-only "All Categories ▾"
  scope-selector (`border-l` divider, hidden below `sm`, no separate link since it doesn't change
  the destination page), and a green circular search button that's a real
  `<a href="./search.html">`.
- **Wishlist / Cart icon cluster** — `♡` / `🛒` unicode glyphs with a small white count-badge, label
  + subtext (item count / ₹ total) hidden below `lg`. **Static placeholders only — no `href`, not
  real links.** This is a deliberate exception to the "real where plain HTML can do it for real"
  principle used everywhere else in these mocks: Wishlist is permanently out of SRS scope and Cart
  is a future v0.4 milestone, so there is no page for these to link to. They're included per an
  explicit user decision to visually nod at those future milestones, not a claim they're built.
- **Account/Login — omitted entirely**, unlike Wishlist/Cart. Same reasoning (Auth is v0.3, not
  built) applied more strictly: no icon, no placeholder, nothing. The user drew this distinction
  explicitly — Wishlist/Cart got a placeholder, Account/Login did not.
- No icon library exists in `mock-ui` (confirmed: `react-icons` etc. are `admin-app`/`buyer-app`
  *source* dependencies, never imported here) — all icons above are unicode glyphs, matching the
  existing `▾` convention and `admin-app/product-list.html`'s `✎ ✓ ✕ ↺` icons.

## Files this applies to

All 5 files in `mock-ui/buyer-app/`: `index.html`, `home.html`, `category.html`, `search.html`,
`product-detail.html`. The header pattern above is scoped to the 4 real content pages, noted
separately.
