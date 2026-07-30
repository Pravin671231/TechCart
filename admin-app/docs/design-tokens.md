# admin-app — design tokens

`mock-ui/` is deliberately grayscale — its README states it implies "no brand colours, type
scale, or spacing system," and SRS v0.2 §10 leaves screen-level visual design open (only
structural layout is resolved there). This doc is that resolution, scoped to `admin-app` only.
`buyer-app` does not use these tokens yet.

Defined in [`src/index.css`](../src/index.css) via a Tailwind v4 `@theme` block — semantic
aliases on top of Tailwind's built-in palette, not hand-rolled hex values. That keeps the
underlying color ramps (contrast steps, accessibility) as Tailwind ships them, while giving
components a semantic name (`bg-primary-600`) that stays stable if the brand color ever changes.

## Colors

| Role      | Alias                                | Underlying scale | Usage                                                                  |
| --------- | ------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Primary   | `primary` / `primary-50`…`primary-900` | Tailwind `green`  | Primary buttons, links, active nav state, focus rings                   |
| Success   | `success` / `success-50`, `-100`, `-600`, `-700` | Tailwind `green` | "Published" status badges, success toasts — same hue as primary, intentional |
| Warning   | `warning` / `warning-50`, `-100`, `-600`, `-700` | Tailwind `amber` | "Draft" status badges, low-stock flag (`FR-CAT-053`)                    |
| Danger    | `danger` / `danger-50`, `-100`, `-600`, `-700`   | Tailwind `red`    | Destructive actions, delete-guard rejections (`FR-CAT-019`, `028`)      |
| Neutral   | `neutral-*` (Tailwind default, unaliased) | Tailwind `neutral` | Chrome surfaces/borders (`Sidebar`/`Header`), muted text, "Archived" status |

`primary-600` is `#16A34A`. Use `primary` (not `primary-600`) in component code where possible —
it stays correct if the underlying shade is ever adjusted.

## Radius

Tailwind's default radius scale, no new tokens — just usage rules:

| Class         | Size  | Use for                                      |
| ------------- | ----- | --------------------------------------------- |
| `rounded-md`  | 6px   | Inputs, checkboxes, small controls             |
| `rounded-lg`  | 8px   | Buttons, cards, table containers               |
| `rounded-xl`  | 12px  | Modals, panels                                 |
| `rounded-full`| —     | Avatars, badges, pills                         |

## Spacing

Standard Tailwind 4px-based scale. Values below are the ones already in active use across
`mock-ui/admin-app/*.html` — codifying the existing wireframe spacing (the mock-ui README's
stated intent is that its utility classes get lifted straight into real components) rather than
inventing a new one:

| Class                    | Use for                                             |
| ------------------------ | ---------------------------------------------------- |
| `px-3 py-2`               | Table cell padding (dominant pattern across mocks)    |
| `px-2 py-0.5`              | Status badges, small pills                            |
| `px-3 py-1.5`              | Filter controls, compact buttons                      |
| `p-4`                      | Card padding                                          |
| `p-6`                      | Page-level content padding                            |
| `gap-2` / `gap-3` / `gap-4`| Flex layout spacing (toolbar items, filter rows)      |
| `space-y-4` / `space-y-6` | Stacked form sections                                 |
