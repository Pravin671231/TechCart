# mock-ui

Static layout wireframes for the two TechCart frontends.

| File                                           | Layout                                    |
| ---------------------------------------------- | ----------------------------------------- |
| [`admin-app/index.html`](admin-app/index.html) | Side bar (full height) + Header + Content |
| [`buyer-app/index.html`](buyer-app/index.html) | Header (sticky) + Content + Footer        |
| [`index.html`](index.html)                     | Entry page linking to both                |

## What these are

**Structural wireframes only** — the outer page chrome each app's real routes will eventually
mount inside. Grayscale boxes with literal labels, no invented design decisions.

They are **not** a design system, not visual design, and not per-screen mocks. Screen-level
designs for the catalog (buyer: catalog listing, category page, search results, product detail;
admin: product list/detail/form, category and brand management) are described behaviourally in
[`docs/srs/features/0.2-product-catalog.md`](../docs/srs/features/0.2-product-catalog.md) §6, and
where their design lives is still an open question in that document's §10.

## Viewing them

Open any `.html` directly in a browser — `file://` works, no server needed. Or:

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
deployed, and nothing in `backend/`, `buyer-app/`, or `admin-app/` imports them.
