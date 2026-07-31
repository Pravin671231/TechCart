# buyer-app — design system

This is the design guideline for `buyer-app`, the TechCart storefront: color palette, typography,
radius, borders, spacing, responsive breakpoints, and layout behavior across screen sizes.

`buyer-app` currently has no tokens at all — [`globals.css`](../src/app/globals.css) is a single
`@import "tailwindcss";` and the only screen is [`HomePlaceholder.tsx`](../src/features/home/HomePlaceholder.tsx).
This doc is net-new territory, not a rewrite of an existing system. `admin-app` has its own separate
[`admin-app/docs/design.md`](../../admin-app/docs/design.md) — the two apps don't share a token file. Where a
value below matches the console's (the primary green, the radius scale), that's deliberate brand
consistency, not a shared import: the storefront and console should read as one product.

`mock-ui/buyer-app/*.html` (`index`, `home`, `category`, `search`, `product-detail`) is structural
wireframes only — its README states it implies "no brand colours, type scale, or spacing system."
This doc resolves that for `buyer-app`, but keeps the structural patterns already proven out there
(container width, grid breakpoints, sticky header) since they're layout decisions, not visual ones.

## Principles

- **Tailwind CSS 4, CSS-first.** No `tailwind.config.js`. Tokens live in a single `@theme` block in
  `src/app/globals.css`, matching `admin-app`'s approach.
- **Tokens are semantic aliases over Tailwind's built-in ramps**, never hand-rolled hex — see
  `admin-app/docs/design.md` § Principles for the full rationale; it applies equally here.
- **Readability over density.** This is a marketing/browsing/checkout surface, not a data console —
  the UI default text size is `text-base` (16px), not `text-sm`. Compare to `admin-app`, whose
  default is `text-sm` for table density.
- **Primary color is reserved for calls-to-action** (Add to Cart, Buy Now, active nav state) — not
  for price or product-title emphasis, which use neutral weight/size instead. This keeps the one
  green accent meaningful on a page with many products competing for attention.

## Colors

Same role table as `admin-app` — same brand, same aliases, defined independently in this app's own
`@theme` block:

| Role    | Alias                                            | Underlying scale  | Usage                                                                 |
| ------- | ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| Primary | `primary` / `primary-50`…`primary-900`             | Tailwind `green`   | Add to Cart / Buy Now buttons, active nav/link state, focus rings        |
| Success | `success` / `success-100`, `-600`, `-700`          | Tailwind `green`   | Order confirmation, "In Stock" state                                    |
| Warning | `warning` / `warning-100`, `-600`, `-700`          | Tailwind `amber`   | "Only N left" low-stock nudges, rating stars (`amber-400` fill)         |
| Danger  | `danger` / `danger-100`, `-600`, `-700`            | Tailwind `red`     | Discount badges/strike-through savings, "Out of Stock", form errors      |
| Neutral | `neutral-*` (Tailwind default, **unaliased**)      | Tailwind `neutral` | Body text, borders, product-card chrome, header/footer surfaces         |

**Resolved primary value:** `primary-600` = `oklch(62.7% 0.194 149.214)` ≈ **#00A63E** (Tailwind
v4.3.3's actual green-600 — see `admin-app/docs/design.md` § Colors for the full oklch table and the
`#16A34A`-vs-v4 discrepancy to avoid repeating here).

**Surface / text roles:**

| Role                | Class               | Where                                          |
| --------------------- | ------------------- | ------------------------------------------------- |
| Page background       | `bg-white`           | `<body>`                                          |
| Header / footer surface | `bg-neutral-50`    | Sticky header, footer                             |
| Card border            | `border-neutral-200` | Product cards, PDP sections                      |
| Body text              | `text-neutral-700`   | Default paragraph/product copy                    |
| Muted text             | `text-neutral-500`   | Breadcrumbs, meta ("by Brand · Category"), captions |
| Strike-through price   | `text-neutral-400`   | Original price when discounted                    |
| Emphasis               | `text-neutral-900`   | Price, product title on PDP                        |

## Typography

**Family:** [Inter](https://fonts.google.com/specimen/Inter), documented here as the chosen
typeface — **not yet wired**; `layout.tsx` and `globals.css` currently render on Tailwind's default
`--font-sans` stack. Intended path: `next/font/google` (Next 16 downloads and self-serves the font
at build time — no runtime request to Google, no font-swap layout shift), exposed as `--font-inter`
via `variable: "--font-inter"` on the `Inter(...)` call, applied to `<html>` via `inter.variable`,
and mapped to `--font-sans` in a `globals.css` `@theme` block. Same typeface as `admin-app` for
brand consistency across the two apps — wire independently, since neither app imports the other's
config. Wire this as a follow-up implementation task.

**Type scale** — Tailwind's default scale, roles oriented to storefront content rather than console
chrome:

| Role                   | Class      | Size            | Line-height     | Weight / tracking                  |
| ----------------------- | ---------- | ---------------- | ------------------ | ------------------------------------- |
| Marketing hero          | `text-4xl` | 2.25rem / 36px   | 2.5rem / 40px       | `font-semibold` `tracking-tight`      |
| Product title (PDP h1)  | `text-2xl` | 1.5rem / 24px    | 2rem / 32px         | `font-semibold` `tracking-tight`      |
| Section heading (h2)    | `text-xl`  | 1.25rem / 20px   | 1.75rem / 28px       | `font-semibold` `tracking-tight`      |
| Price (PDP)             | `text-2xl` | 1.5rem / 24px    | 2rem / 32px         | `font-medium` — not bold; weight, not size, signals emphasis on price vs. title |
| **Body**                | `text-base`| 1rem / 16px      | 1.5rem / 24px        | `font-normal`                         |
| Product-card title/price| `text-sm`  | 0.875rem / 14px  | 1.25rem / 20px       | `font-normal` (title) / `font-medium` (price) |
| Nav link / UI control   | `text-sm`  | 0.875rem / 14px  | 1.25rem / 20px       | `font-medium`                         |
| Caption / meta          | `text-xs`  | 0.75rem / 12px   | 1rem / 16px          | `font-normal`, `text-neutral-400`/`-500` |

**Weights:** 400 body/product-card titles · 500 nav links, prices, buttons · 600 headings and hero.
No `font-bold` (700) role — the storefront's emphasis hierarchy is carried by size and color, not
extra-bold weight, keeping the page calmer with many competing products on screen.

**Tracking:** `tracking-tight` (-0.025em) on `text-xl`+ headings and the hero only; normal
everywhere else, including product titles (unlike `admin-app`'s wordmark, product names are
user-generated-length content that shouldn't be visually compressed).

**Measure:** cap long-form prose (product descriptions, policy pages) at **`max-w-prose`**
(65ch) for readability. Product grids, the PDP gallery, and the header are exempt — those are
layout-driven widths, not text blocks.

**Responsive type:** the hero and PDP/page titles step down one size on Mobile — `text-3xl md:text-4xl`
for the hero, for example — since a 36px headline is disproportionate on a 375px viewport. Body,
card, and nav text stay fixed across all breakpoints; only the largest marketing sizes flex.

## Radius

| Class          | Size  | Use for                                                |
| -------------- | ----- | --------------------------------------------------------- |
| `rounded-md`   | 6px   | Inputs, quantity steppers, small controls                  |
| `rounded-lg`   | 8px   | Product cards, buttons, PDP sections                       |
| `rounded-xl`   | 12px  | Modals (cart drawer, quick-view), promo banners              |
| `rounded-full` | —     | Discount/badge pills, rating chip, avatar (account menu)     |

`mock-ui/buyer-app` renders everything square (bordered boxes, no radius) — that's wireframe
simplicity per its README's disclaimer, not a visual decision. This scale is the storefront's actual
resolution, matching `admin-app`'s scale for consistency between the two apps.

## Borders

- Default is a **1px hairline** (`border border-neutral-200`) on product cards and PDP sections —
  no shadow/elevation system, same principle as `admin-app`.
- Selected/active state (a chosen thumbnail, a chosen variant swatch) gets a **2px** border in
  `primary` or `neutral-900`, not a background fill — keeps the grid visually quiet.
- Focus: `focus-visible:ring-2 ring-primary ring-offset-2` on every interactive element (product
  card link, Add to Cart, filters) — never remove an outline without this replacement.

## Spacing

| Class                     | Use for                                                        |
| --------------------------- | ------------------------------------------------------------------ |
| `px-4`                       | Container edge padding on Mobile/Tablet                           |
| `px-6`                        | Container edge padding on Laptop+ (`lg:px-6`)                     |
| `py-6`                          | Page-level vertical padding (`<main>`)                           |
| `gap-4`                          | Product grid gutter, card internal spacing                       |
| `gap-8`                            | PDP gallery/buy-box column gap (`lg:grid-cols-2`)                |
| `p-3`                                | Product-card internal padding (image caption block)             |
| `px-2 py-0.5`                          | Discount/status badge padding                                 |
| `space-y-5` / `space-y-6`                | Stacked PDP sections (price → variants → CTA → description) |

**Container:** `mx-auto w-full max-w-7xl` (1280px) at every content width, matching
`mock-ui/buyer-app`'s established pattern — the storefront's content cap, unlike `admin-app`'s
deliberately fluid/uncapped console content area.

## Responsive breakpoints

Same five-range scale as `admin-app`, for consistency across the project (same physical devices
browse both apps, even though only admin has real screens using the far end of it today):

| Range         | Width         | Tailwind prefix          |
| ------------- | ------------- | -------------------------- |
| Mobile        | 320–767px      | *(default, unprefixed)*    |
| Tablet        | 768–1023px      | `md:`                      |
| Laptop        | 1024–1279px      | `lg:`                      |
| Desktop       | 1280–1439px       | `xl:`                      |
| Large Desktop | 1440px+            | `2xl:`                     |

Add the equivalent `--breakpoint-2xl: 90rem;` override to `globals.css`'s `@theme` block when it's
created, so `2xl:` lands on 1440px here too — **not done yet**, since no component uses `2xl:` until
a real screen needs it. Avoid bare `sm:` (640px per Tailwind default) for the same reason
`admin-app/docs/design.md` flags it: it falls mid-Mobile-range in this scale.

## Layout behavior across screen sizes

*(Forward guidance for the screens sketched in `mock-ui/buyer-app` — `home`/category listing,
`search`, `product-detail` — none are built yet beyond `HomePlaceholder`.)*

| Element              | Mobile (< 768px)                    | Tablet (768–1023px)         | Laptop+ (1024px+)              |
| ---------------------- | -------------------------------------- | ------------------------------ | ---------------------------------- |
| Header                  | Sticky, `h-16`, hamburger menu (nav links hidden) | same, nav links can appear at `md:flex` | same, plus visible search bar     |
| Product grid            | 2 columns (`grid-cols-2`)             | 3 columns (`md:grid-cols-3`)    | 4 columns (`lg:grid-cols-4`)       |
| PDP gallery / buy-box    | Stacked, gallery above buy-box       | same as Mobile                  | Side-by-side (`lg:grid-cols-2`, `gap-8`) |
| Container padding        | `px-4`                               | `px-4`                          | `px-6` (`lg:px-6`)                 |

**Header:** sticky (`sticky top-0 z-20`), matching `mock-ui/buyer-app`'s established pattern across
every page (`home`, `product-detail`). Nav links (Categories, Deals, Account, Cart) collapse behind
a hamburger below `md`, following the same off-canvas-drawer idiom as `admin-app`'s `Sidebar` for
consistency in interaction pattern, even though the visual surface differs (a top drawer/sheet here
vs. a side drawer there — the storefront has no persistent side nav to preserve).

**Product grid:** 2 columns even at the narrowest Mobile width (375px) rather than 1 — verified
against `mock-ui/buyer-app/home.html`'s `sm:grid-cols-2 xl:grid-cols-4` pattern, adjusted onto this
doc's own breakpoint scale (`grid-cols-2` default → `md:grid-cols-3` → `lg:grid-cols-4`) so it
doesn't rely on the discouraged bare `sm:`. Two columns keeps product thumbnails browsable without
excessive scrolling on a phone.

**Product-detail page:** gallery and buy-box (price, variants, Add to Cart) stack vertically through
Tablet, then move to a two-column `lg:grid-cols-2` layout — matching
`mock-ui/buyer-app/product-detail.html`'s structural pattern. Thumbnail rail below the main image:
`h-16 w-16` (64px) swatches.

## Icons

No icon library is installed in `buyer-app` yet (`package.json` has no `react-icons` or equivalent).
When one is needed, use `react-icons`'s `lu` (Lucide) set — same as `admin-app` — for visual
consistency across the project, at the same sizes: `h-4 w-4` (16px) inline, `h-5 w-5` (20px)
standalone (cart icon, hamburger).

## Motion

`transition-colors duration-200` for hover/active states (product-card border on hover, nav link
underline). Honor `prefers-reduced-motion` for any cart-drawer/modal slide-in animation.

## Where tokens live

| Layer                          | Role                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `buyer-app/docs/design.md` (this doc) | The rules — colors, type, radius, borders, spacing, breakpoints, layout |
| `src/app/layout.tsx`               | Intended home for `next/font/google` Inter, once wired — **not yet added** |
| `src/app/globals.css` `@theme` block | **Not yet created** — the whole file is still the single `@import "tailwindcss";` line |

Every token in this doc — font included — is written ahead of the components that would consume it
(see `docs/srs/features/0.2-product-catalog.md` for what's coming) and is deliberately *not* added
to `globals.css` speculatively. Wire the `@theme` block incrementally as each screen is built,
following `admin-app/src/index.css`'s shape.
