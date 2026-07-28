# mock-ui

Static layout wireframes for the two TechCart frontends.

## Shell layouts

The outer page chrome each app's real routes mount inside. Grayscale boxes with literal labels.

| File                                           | Layout                                    |
| ---------------------------------------------- | ----------------------------------------- |
| [`admin-app/index.html`](admin-app/index.html) | Side bar (full height) + Header + Content |
| [`buyer-app/index.html`](buyer-app/index.html) | Header (sticky) + Content + Footer        |

## Catalog screens — SRS v0.2

Every screen [`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md)
§6 defines, built inside the shells above. Each page carries an annotation strip naming the
`FR-CAT-*` requirements it renders, so a mock can be read against the SRS line by line.

**`buyer-app`**

| File                                                             | Screen              | Key requirements                         |
| ---------------------------------------------------------------- | ------------------- | ---------------------------------------- |
| [`buyer-app/home.html`](buyer-app/home.html)                     | Home / all-products | `FR-CAT-054`, `057–059`, `075`, `091`    |
| [`buyer-app/category.html`](buyer-app/category.html)             | Category listing    | `FR-CAT-055`, `070`, `092`               |
| [`buyer-app/search.html`](buyer-app/search.html)                 | Search results      | `FR-CAT-065`, `067`, `075`               |
| [`buyer-app/product-detail.html`](buyer-app/product-detail.html) | Product detail      | `FR-CAT-056`, `059`, `063`, `064`, `084` |

**`admin-app`**

| File                                                                         | Screen                     | Key requirements                              |
| ---------------------------------------------------------------------------- | -------------------------- | --------------------------------------------- |
| [`admin-app/product-list.html`](admin-app/product-list.html)                 | Product list               | `FR-CAT-005`, `011`, `050`, `053`             |
| [`admin-app/product-detail.html`](admin-app/product-detail.html)             | Product detail (read-only) | `FR-CAT-006`, `013`, `043`, `045`             |
| [`admin-app/product-form.html`](admin-app/product-form.html)                 | Product create / edit      | `FR-CAT-001`–`004`, `033`, `038`, `083`–`087` |
| [`admin-app/category-list.html`](admin-app/category-list.html)               | Categories list + form     | `FR-CAT-014`–`022`, `048`, `051`              |
| [`admin-app/brand-list.html`](admin-app/brand-list.html)                     | Brands list + form         | `FR-CAT-023`–`028`, `048`, `052`              |
| [`admin-app/specification-editor.html`](admin-app/specification-editor.html) | Spec schema editor         | `FR-CAT-030`, `031`, `035`, `092`             |
| [`admin-app/variant-type-editor.html`](admin-app/variant-type-editor.html)   | Variant-axis editor        | `FR-CAT-036`–`038`                            |

Non-happy-path states the SRS calls for are mocked alongside the happy path rather than skipped:
skeleton / empty / error listing states on `home.html`, the two distinct empty states on
`search.html`, and the guard rejections (`FR-CAT-019`, `028`, `031`, `041`) shown inline on the
admin pages that raise them.

## What these are — and are not

**Structural wireframes.** They show layout, information hierarchy, and which requirement each
region satisfies. They are **not** visual design, not a design system, and not a component
library — no brand colours, type scale, or spacing system is implied by them. Where the SRS
specifies UI _behaviour_, these mocks show _where that behaviour lives on the page_.

Per [`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md) §10
Open Question 1, screen-level design was undecided at the time the SRS was drafted. These pages
are a first pass at answering it and are not themselves normative — the SRS remains the source of
truth for what the UI must do. Placeholder content (product names, SKUs, prices, specification
fields) is illustrative only.

## Viewing them

Open any `.html` directly in a browser — `file://` works, no server needed. Start at
[`index.html`](index.html), which links every page. Or:

```bash
npx serve mock-ui
```

**An internet connection is required.** Tailwind is loaded from a CDN
(`@tailwindcss/browser@4`, matching the `tailwindcss@4` the real workspaces use). Offline, the
pages fall back to unstyled HTML.

Utility classes here are deliberately the same ones the real apps use, so they can be lifted
straight into `buyer-app`/`admin-app` components later.

## Relationship to the workspaces

These files are **not part of any npm workspace**. They are not built, linted, tested, or
deployed, and nothing in `backend/`, `buyer-app/`, or `admin-app/` imports them. They contain no
standalone `.js` files, so the root `eslint .` run — the CI `lint` job — does not touch them.
