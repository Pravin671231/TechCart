# Issue Drafts

**Project:** TechCart
**Status:** M0 (Foundation) and M1 (CI Pipeline) are complete/in progress and already tracked as closed GitHub issues (#1–#10) — their draft text has been removed from this file; see `docs/milestone.md` for their roadmap-level record. This file now holds only the **Backlog**: milestones fully drafted but not yet opened as real GitHub issues, starting with M2 (Product Catalog, backend only).

This is where issues get drafted — full context, a build-order task checklist, and test criteria — before they're opened as real GitHub Issues. It sits between [docs/milestone.md](milestone.md) (which milestone/goal) and GitHub itself (which is the actual tracker once an issue is opened): draft it here, then `gh issue create` it, then work it via the branch/PR flow in [docs/srs/SRS.md](srs/SRS.md) §5. Once a milestone's issues are opened on GitHub, its draft section is removed from here the same way M0/M1's were.

**Scope of this file right now:** the Backlog holds M2 only. M2's 12 issues cover every `FR-CAT-001`–`096` requirement in [`docs/srs/features/0.2-product-catalog.md`](srs/features/0.2-product-catalog.md); `buyer-app`/`admin-app` screen implementation for M2 is deliberately not drafted yet, pending that SRS's own §10 open question on screen-level UI design. Every later milestone (M3 Authentication onward) needs its functional requirements from that feature's SRS doc (`docs/srs/features/<version>-<feature>.md`) before its issues can be drafted with real content — none of those exist yet. This file gains a new Backlog subsection one milestone at a time, as each feature's SRS doc is written.

**Numbering:** `M2.1`, `M2.2`, etc. are draft sequence numbers, not GitHub issue numbers. When an issue is actually opened (`gh issue create`), use the real assigned number for its branch: `feature/<real-issue-number>-<scope>`.

---

## Template

Every milestone in the Backlog is a `###` section; every issue inside it follows this shape, one heading level deeper:

```
#### <Milestone>.<N> — <Title>
**Milestone:** M<x> – <Milestone name>
**Suggested branch:** feature/<issue-number>-<scope>
**Labels:** <labels>

**Context**
<Why this issue exists, what it depends on, what it unblocks.>

**Tasks**
- [ ] <ordered implementation step>

**Test Criteria**
- <verifiable, unambiguous condition>
```

---

## Backlog

Milestones in this section are fully drafted — issues with real Context/Tasks/Test Criteria — but not yet opened as real GitHub Issues or a GitHub Milestone, unlike M0 and M1 above which are already complete or in progress on GitHub. A milestone moves out of this section once its issues are actually opened via `gh issue create`.

### M2 — Product Catalog

Drafted from [`docs/srs/features/0.2-product-catalog.md`](srs/features/0.2-product-catalog.md) (`FR-CAT-001`–`096`). Every ID is assigned to exactly one issue below; the 12 issues are ordered so each one's real dependencies are already merged before it starts. This is backend-only: `buyer-app`/`admin-app` screen implementation is deliberately not drafted yet, because the SRS's own §10 open question (screen-level UI design) is unresolved, and drafting frontend issues without it would mean inventing screen behaviour the SRS doesn't specify. It becomes draftable once that's settled.

New label used throughout: `catalog` (mirrors how M0/M1 use `infra` as their cross-cutting label) — doesn't exist as a GitHub label yet; create it before running `gh issue create` on any of these.

#### M2.1 — Core plumbing: Mongo connection, response envelope, admin auth guard

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-core-plumbing`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-088`–`090`, `093`, `094`. This is the first feature to touch MongoDB for real — `backend/src/config/db.ts` is currently a no-op stub (M0.2) — and the first to need input validation, so it's also where `zod` is added. Nothing else in M2 can be built or tested without this: every admin route needs the auth guard, and every response — admin or buyer — needs the envelope.

**Tasks**

- [ ] Replace `backend/src/config/db.ts`'s stub with a live Mongoose connection; include startup failure handling so the process never silently serves traffic against a dead connection (full retry/resilience policy is deferred to v0.8)
- [ ] Add `zod` as a `backend` dependency
- [ ] Shared success-envelope helper: `{ success: true, data }`, with an optional `pagination` sibling (`page`, `limit`, `total`, `totalPages`, `hasNextPage`) for list endpoints only — never sent as `null`/`{}` on detail endpoints (`FR-CAT-093`, `FR-CAT-094`)
- [ ] Admin shared-secret middleware (`X-Admin-Key` against a server-side env var), applied at the router level, returning 401 in the existing error contract before any controller runs (`FR-CAT-088`, `FR-CAT-089`)
- [ ] Write the guard as an isolated, swappable layer so the v0.3 RBAC swap touches only the guard itself (`FR-CAT-090`)

**Test Criteria**

- The app starts and connects to a real MongoDB instance; killing the DB before startup fails loudly rather than serving requests
- A stub list route returns `{ success: true, data: [...], pagination: {...} }`; a stub detail route returns `{ success: true, data: {...} }` with no `pagination` key
- A request to a route behind the guard with a missing or wrong `X-Admin-Key` is rejected 401 in the `{ success: false, code, message }` shape before any handler logic runs
- The correct key allows the request through

---

#### M2.2 — Cloudflare R2 image upload (presign flow)

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-r2-uploads`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-077`–`084`. Entity-agnostic by design — object keys are `{purpose}/{uuid}.{ext}`, never keyed by a product/brand/category ID, because none of those may exist yet at upload time (`FR-CAT-079`). Built before brand/category/product CRUD so those issues can register real image URLs against something real instead of stubbing this out.

**Tasks**

- [ ] `POST /api/admin/uploads/presign`, behind the M2.1 guard, accepting `purpose` (`product-image` | `brand-logo` | `category-image`) and a declared content type
- [ ] Reject content types other than JPEG/PNG/WebP before issuing a URL (`FR-CAT-078`)
- [ ] Generate the object key server-side as `{purpose}/{uuid}.{ext}`; ignore any client-supplied key hint (`FR-CAT-079`)
- [ ] Issue presigned URLs with a 5-minute expiry (`FR-CAT-080`)
- [ ] Track issued-but-unconsumed keys server-side; on registration, validate the key was actually issued and not already consumed (`FR-CAT-082`)
- [ ] Enforce image-count bounds at registration time: 1–8 for a product, 1–2 for a variant when present (`FR-CAT-083`)
- [ ] Support `alt` text and a single `isPrimary` designation per image, with automatic promotion of the first remaining image if the primary is removed (`FR-CAT-084`)

**Test Criteria**

- Requesting a presign for a disallowed content type is rejected before any URL is issued
- The returned object key matches `{purpose}/{uuid}.{ext}` regardless of any key the client attempts to supply
- A presigned URL used more than 5 minutes after issuance is rejected by R2
- Registering an image URL whose key was never issued, or was already consumed, is rejected
- Registering a 9th product image, or a 3rd variant image, is rejected; registering 0 variant images is allowed
- Removing the primary image automatically promotes the next remaining image to primary

---

#### M2.3 — Brand management

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-brands`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-023`–`029`. Brands exist as a first-class entity solely because buyers filter by brand (`FR-CAT-069`) — a filter needs a managed collection behind it. Depends on M2.1 (guard, envelope) and M2.2 (logo upload).

**Tasks**

- [ ] `brands` Mongoose model: `name`, `slug` (unique), `logo` (optional), `description` (optional), `status` (boolean, default `true`)
- [ ] `POST /api/admin/brands` — create, with the same slug auto-generation/collision-suffix behaviour as `FR-CAT-002` (`FR-CAT-023`, `FR-CAT-024`)
- [ ] `PATCH /api/admin/brands/:id` — update name/logo/description (`FR-CAT-025`)
- [ ] `GET /api/admin/brands` — list with product count per brand (`FR-CAT-026`)
- [ ] `GET /api/admin/brands/:id` — single brand, any status (`FR-CAT-027`)
- [ ] `DELETE /api/admin/brands/:id` — rejected unless zero products of any status reference it (`FR-CAT-028`)
- [ ] `GET /api/brands` — public list, active only, public fields only

**Test Criteria**

- Two brands created with the same name receive distinct slugs
- Deleting a brand referenced by an archived-only product is still rejected
- The admin brand list's product count matches the number of products actually referencing each brand, across all statuses
- The public brand list excludes inactive brands and admin-only fields

---

#### M2.4 — Category management

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-categories`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-014`–`022`. Depends on M2.1 (guard, envelope) and M2.2 (category image upload). Categories must exist before the specification (M2.5) and variant-type (M2.6) documents that hang off them, and before products (M2.7) can reference one.

**Tasks**

- [ ] `categories` Mongoose model: `name`, `slug` (unique), `parentCategory` (nullable ref, one level max), `status` (boolean, default `true`), `sortOrder` (integer, default `0`), `image` (optional), `metaTitle`/`metaDescription` (optional)
- [ ] `POST /api/admin/categories` — create, rejecting a parent that itself already has a parent (`FR-CAT-014`, `FR-CAT-015`)
- [ ] `PATCH /api/admin/categories/:id` — update name/parent/image/`sortOrder`/SEO fields (`FR-CAT-016`)
- [ ] `GET /api/admin/categories` — list with parent/child structure and product count (`FR-CAT-017`)
- [ ] `GET /api/admin/categories/:id` — single category, any status (`FR-CAT-018`)
- [ ] `DELETE /api/admin/categories/:id` — rejected unless zero direct products and zero subcategories; on success, cascade-delete that category's specification and variant-type documents once M2.5/M2.6 exist (`FR-CAT-019`)
- [ ] `GET /api/categories` — public list, active only, ordered by `sortOrder` then name, parent/child structure and display fields only (`FR-CAT-020`, `FR-CAT-061`)

**Test Criteria**

- Creating a subcategory under an existing subcategory is rejected
- Deleting a category with products or subcategories fails with an error naming which guard blocked it
- The public category list is ordered by `sortOrder` ascending, name as tiebreaker, and excludes inactive categories
- A category missing `metaTitle`/`metaDescription` falls back to name and a description truncation on buyer-facing reads

---

#### M2.5 — Category-governed specifications

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-category-specifications`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-030`–`035`. Depends on M2.4 — one specification document per category, so categories must exist first. Product creation (M2.7) validates against this schema, so it must land before M2.7.

**Tasks**

- [ ] `categorySpecifications` model: one document per category (`category` ref, unique), `specificationGroups: [{ groupName, specifications: [{ name, type: text|number|boolean|enum, unit?, options? (required when enum), required, filterable }] }]`
- [ ] `filterable` accepted only on `enum`, `boolean`, and `number` fields; rejected on `text` (`FR-CAT-035`)
- [ ] `POST`/`PATCH`/`DELETE` routes for a category's specification groups and individual fields
- [ ] Deleting a field referenced by ≥1 product's stored specifications (matched on `groupName` + `name`) is rejected, naming the blocking product count (`FR-CAT-031`)
- [ ] Expose the schema for a category so the product create/edit path (M2.7) can validate against it: required-field presence, unknown-key rejection, type matching, `enum` value within `options` (`FR-CAT-032`)

**Test Criteria**

- Setting `filterable: true` on a `text` field is rejected; on `enum`/`boolean`/`number` it succeeds
- Deleting a specification field currently used by a product is rejected with the blocking count; deleting an unused one succeeds
- Field declaration order is preserved on read, since it determines card/filter ordering downstream (M2.11, M2.12)

---

#### M2.6 — Category-governed variant types

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-category-variant-types`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-036`–`038`. Depends on M2.4. Unlike M2.5, this is a UI-rendering guide only — never enforced against stored variant attributes — so it carries no in-use delete guard, a deliberate asymmetry with M2.5 worth keeping visible in review rather than "fixing" for consistency.

**Tasks**

- [ ] `categoryVariantTypes` model: one document per category (`category` ref, unique), `axes: [{ name, code, type: text|select|color|number (default select), required, options?: [{label, value}] }]`
- [ ] `POST`/`PATCH`/`DELETE` routes for a category's variant-axis definitions
- [ ] Deletion succeeds unconditionally, even while products hold variants using that axis (`FR-CAT-037`)
- [ ] Expose the axis list per category so the admin variant editor (M2.8's frontend counterpart, once drafted) can render the matching control per axis (`FR-CAT-038`)

**Test Criteria**

- Deleting a variant axis succeeds even when ≥1 product variant currently uses it — no guard, by design
- The axis list returned for a category preserves declared `type` and `options` faithfully

---

#### M2.7 — Product core CRUD and pricing

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-products-core`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-001`–`013` and `FR-CAT-085`–`087`. The spine of M2 — depends on M2.2 (images), M2.3 (brand ref), M2.4 (category ref), and M2.5 (specification validation), all of which must exist for product create/update to have anything real to validate against. Pricing (`FR-CAT-085`–`087`) is built here rather than as its own issue: `sellingPrice`'s server-side computation is exercised identically by products and variants, so it's a shared utility M2.8 reuses rather than something existing independently of anything that writes a price.

**Tasks**

- [ ] `products` model: `name`, `slug` (unique), `sku` (unique, shared namespace with embedded variant SKUs), `description`, `brand` (required ref), `category` (required ref), `images` (1–8), `specifications`, `mrp`/`discount`/`sellingPrice`, `stock`, `status` (default `draft`), `isFeatured` (default `false`), `lowStockThreshold` (default `0`), `metaTitle`/`metaDescription`, `createdBy`/`updatedBy` (reserved `null` in this version)
- [ ] Shared pricing utility: `sellingPrice = mrp - floor(mrp * discount / 100)`, computed server-side on every write, client-submitted values ignored not rejected (`FR-CAT-087`); `mrp` a positive integer paise (`FR-CAT-085`); `discount` an integer 0–99 (`FR-CAT-086`)
- [ ] `POST /api/admin/products` — create, requiring a valid brand and category reference, validating specifications against the category's schema from M2.5 (`FR-CAT-001`, `FR-CAT-029`, `FR-CAT-032`)
- [ ] `PATCH /api/admin/products/:id` — update any editable field; re-validate specifications if `category` changes, rejecting with the offending fields if the existing values no longer satisfy the new schema (`FR-CAT-004`, `FR-CAT-034`)
- [ ] `GET /api/admin/products` — paginated, sortable, all statuses visible (`FR-CAT-005`)
- [ ] `GET /api/admin/products/:id` — single product, any status, full field set (`FR-CAT-006`)
- [ ] `DELETE /api/admin/products/:id` — soft delete only (`status: archived`), never a hard document removal (`FR-CAT-007`)
- [ ] `PATCH /api/admin/products/:id/stock` — stock-only adjustment path (`FR-CAT-008`, `FR-CAT-009`)
- [ ] SKU uniqueness cross-check: a unique index on `products.sku`, a separate unique multikey index on `products.variants.sku`, plus an application-level check at write time (no single index spans both) (`FR-CAT-003`)

**Test Criteria**

- Creating a product with a duplicate SKU, a non-positive `mrp`, a `discount` of 100, or negative/fractional stock is rejected with a validation error, never a 500
- `mrp: 99900, discount: 10` stores `sellingPrice: 89910`; a `sellingPrice` submitted directly in the request has no effect
- Two products created with the same name receive distinct slugs
- Deleting a product leaves it present with `status: archived` — never hard-removed
- Moving a product to a category whose schema its specifications don't satisfy is rejected, naming the offending fields
- `createdBy`/`updatedBy` are persisted as `null` on every write in this version

---

#### M2.8 — Product variants (embedded, sellable)

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-product-variants`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-039`–`044`. Depends on M2.7 — variants are embedded subdocuments on a product, reusing the same pricing utility M2.7 built rather than reimplementing it.

**Tasks**

- [ ] Embedded `variants` array on the product schema: `sku` (shared namespace, `FR-CAT-003`), `attributes: [{name, value}]` (1+), `mrp`/`discount`/`sellingPrice` (reusing M2.7's pricing utility), `stock`, `weight` (optional), `images` (0 or 1–2), `active` (default `true`)
- [ ] `POST /api/admin/products/:id/variants` — add a variant (`FR-CAT-039`)
- [ ] `PATCH /api/admin/products/:id/variants/:variantId` — update, or set `active: false` as a soft delete; never hard-remove (`FR-CAT-040`)
- [ ] Reject a variant whose attribute-pair set duplicates an existing active or inactive variant's on the same product (`FR-CAT-041`)
- [ ] Apply the same `mrp`/`discount`/`sellingPrice`/`stock` validation as products (`FR-CAT-042`)
- [ ] Determine purchasability: zero active variants → product sells on its own SKU/price/stock; one or more active variants → each variant is the purchasable unit, parent price/stock become display-only (`FR-CAT-043`)
- [ ] A variant carries no independent visibility flag — its buyer-facing visibility is entirely inherited from the parent product's `status` (`FR-CAT-044`)

**Test Criteria**

- Adding two variants with different attribute combinations succeeds; a third duplicating an existing combination is rejected
- A variant SKU colliding with any product's own SKU, or any other variant's SKU on any product, is rejected by the application-level cross-check
- Deactivating a variant leaves it embedded on the document; it is never removed
- Archiving the parent product hides all its variants from every buyer endpoint without touching any variant's own `active` flag

---

#### M2.9 — Status update APIs

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-status-apis`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-045`–`049`. Depends on M2.3, M2.4, and M2.7 all existing, since each entity gets its own dedicated status endpoint rather than folding status into its general update path.

**Tasks**

- [ ] `PATCH /api/admin/products/:id/status` — set `draft`/`published`/`archived` (`FR-CAT-045`)
- [ ] `PATCH /api/admin/categories/:id/status` — toggle boolean `status` (`FR-CAT-046`)
- [ ] `PATCH /api/admin/brands/:id/status` — toggle boolean `status` (`FR-CAT-047`)
- [ ] Deactivating a category/brand hides it from its buyer-facing endpoint immediately, stays visible in the admin console, and does not bypass the M2.3/M2.4 delete guards (`FR-CAT-048`)
- [ ] A product in a deactivated category, or carrying a deactivated brand, stays reachable by its own slug but drops out of that category's/brand's buyer-facing listings and facets (`FR-CAT-049`)

**Test Criteria**

- Setting a product's status to `archived` removes it from every public endpoint immediately while it remains visible in the admin grid
- Deactivating a category hides it from `GET /api/categories` immediately but a direct `GET /api/admin/categories/:id` still returns it
- A product in a deactivated category is still reachable at `/api/products/:slug` but absent from that category's listing
- Deactivating a category with products does not itself trigger or bypass the `FR-CAT-019` delete guard

---

#### M2.10 — Admin search (product/category/brand grids)

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-admin-search`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-050`–`053`. Depends on M2.3, M2.4, and M2.7 — search is only meaningful once the three lists it searches exist. All three use plain MongoDB queries, not Atlas Search, keeping the mechanism identical across lists and confining Atlas Search to buyer-facing paths (M2.11, M2.12).

**Tasks**

- [ ] Product grid search: case-insensitive partial match on `name`, exact-or-prefix match on `sku` (`FR-CAT-050`)
- [ ] Category list search: case-insensitive partial match on `name` (`FR-CAT-051`)
- [ ] Brand list search: case-insensitive partial match on `name` (`FR-CAT-052`)
- [ ] All three respect the existing all-statuses admin visibility rule and compose with a status filter (`FR-CAT-053`)

**Test Criteria**

- Pasting a full SKU into the product search returns exactly that product
- A partial, case-insensitive name search returns all matching products/categories/brands regardless of status
- Search composes with a status filter on the product grid without either narrowing the other incorrectly

---

#### M2.11 — Buyer browsing, search & inventory visibility

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-buyer-browsing`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-054`–`067` and `FR-CAT-095`–`096`. Depends on M2.7 (products to list), M2.4 (categories), and M2.3 (brands). Inventory visibility (`095`/`096`) lands here rather than in M2.1 alongside the rest of the response-envelope work: deriving `availability` needs a real `stock`/`lowStockThreshold` field and real fixtures to assert the admin-key-absence guarantee against, and this is the first buyer endpoint to expose it. Also the first issue to require the MongoDB Atlas Search index actually provisioned against `products` — a real setup step, not an assumption.

**Tasks**

- [ ] Provision the MongoDB Atlas Search index against `products`
- [ ] `GET /api/products` — paginated list of `published` products (`FR-CAT-054`)
- [ ] `GET /api/categories/:slug/products` — paginated list scoped to a category and its subcategories (`FR-CAT-055`)
- [ ] `GET /api/products/:slug` — detail by slug, not ID (ISR cache key + SEO URL) (`FR-CAT-056`)
- [ ] Pagination: fixed default page size, server-enforced max, oversized requests clamped not honoured (`FR-CAT-057`)
- [ ] An empty result set returns a successful empty response, never a 404 or error (`FR-CAT-058`)
- [ ] `draft`/`archived` products never appear on any buyer endpoint under any query combination (`FR-CAT-060`)
- [ ] `GET /api/categories` (buyer) and `GET /api/brands` (buyer) — active-only, public fields only (`FR-CAT-061`, `FR-CAT-062`)
- [ ] Detail page includes every specification pair grouped by `groupName`, filterable or not (`FR-CAT-063`)
- [ ] Default to the lowest-`sellingPrice` active variant on a product with variants; selecting another updates price/`availability`/images, falling back to the parent's images when the selected variant has none (`FR-CAT-064`)
- [ ] `GET /api/products?q=` — Atlas Search keyword search over name and description, fuzzy-matched (`FR-CAT-065`)
- [ ] Category search — plain indexed query, not Atlas Search (`FR-CAT-066`)
- [ ] Search results compose with every M2.12 filter/sort once that issue lands (`FR-CAT-067`)
- [ ] `availability` derivation: `stock: 0` → `out_of_stock`; `0 < stock ≤ lowStockThreshold` → `low_stock` (inclusive); else `in_stock`; product-level `availability` is the best state across active variants (`FR-CAT-096`)
- [ ] Buyer response serializer strips `stock`, `lowStockThreshold`, `status`, `createdBy`, `updatedBy` from every buyer payload — enforced at the response boundary, not per-controller (`FR-CAT-095`)

**Test Criteria**

- A guest loading the catalog sees only `published` products, paginated; an oversized page request is clamped to the server maximum
- A `draft`/`archived` product is absent from every buyer endpoint under every query combination — asserted explicitly, not inferred from a happy-path test
- A product with `stock: 0` is reported `availability: out_of_stock` and still appears in listings
- A response with `stock` exactly equal to `lowStockThreshold` reports `low_stock` (inclusive boundary); a product with `lowStockThreshold: 0` never reports `low_stock`
- A product with one active variant `in_stock` and another `out_of_stock` reports `availability: in_stock` at the product level
- A buyer payload asserted to **not contain** `stock`, `lowStockThreshold`, `status`, `createdBy`, or `updatedBy` — checked by asserting absence, not by a passing happy-path read
- A keyword search returns case-insensitive partial matches, and a close misspelling still returns the intended product
- A search or filter combination with no matches returns a successful empty response

---

#### M2.12 — Buyer filtering, sorting & card content

**Milestone:** M2 – Product Catalog
**Suggested branch:** `feature/<issue-number>-catalog-buyer-filtering`
**Labels:** backend, catalog

**Context**
Implements `FR-CAT-068`–`076` and `FR-CAT-091`–`092`. Depends on M2.11 (the listing endpoint these filters attach to), M2.5 (specification schema), and M2.8 (variant attributes to filter on). Card content lands here rather than as a separate issue because both it and filtering are driven by the same `filterable` flag from M2.5 — splitting them would split one concept across two issues.

**Tasks**

- [ ] Price-range filter against `sellingPrice` (`FR-CAT-068`)
- [ ] Brand filter, one or more brands (`FR-CAT-069`)
- [ ] Category filter, including subcategories (`FR-CAT-070`)
- [ ] Variant-attribute filter (e.g. `Color = Red`) against active variants of published products, via Atlas Search faceting (`FR-CAT-071`)
- [ ] Filterable-specification filter: value match for `enum`/`boolean`, range for `number` (`FR-CAT-072`)
- [ ] In-stock-only filter; a product with variants counts as in-stock if any active variant has stock above zero (`FR-CAT-073`)
- [ ] On-sale-only filter (`discount > 0`) (`FR-CAT-074`)
- [ ] Sort: relevance (search only), price ascending/descending against `sellingPrice`, newest first (`FR-CAT-075`)
- [ ] All filters compose together with a sort option and pagination, applied simultaneously (`FR-CAT-076`)
- [ ] Home/all-products listing cards: primary image, name, `sellingPrice` only, no specifications (`FR-CAT-091`)
- [ ] Category listing cards: primary image, name, first four `filterable` specifications in schema declaration order, `sellingPrice` (`FR-CAT-092`)

**Test Criteria**

- Price, brand, category, variant-attribute, specification, in-stock, and on-sale filters each work individually and in combination with a sort option and pagination
- A specification field not marked `filterable` is never offered as a facet, is rejected as a filter parameter, and never appears on a category card
- A `number`-typed filterable specification filters by range; `enum`/`boolean` filter by exact value
- Sorting by price ascending/descending orders by `sellingPrice`, not `mrp`
- A home/all-products card shows no specification pairs even when every listed product's category has filterable specifications defined
- A category whose schema marks six fields filterable shows exactly the first four on its cards, in declaration order; reordering the schema changes which four appear
- A product in a category with fewer than four filterable fields shows only the pairs it has; a category with none renders a card identical to the home variant
- Marking a fifth field filterable is accepted in the filter rail without being rejected for exceeding the card display limit
