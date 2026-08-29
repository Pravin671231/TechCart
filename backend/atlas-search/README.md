# Atlas Search index — `products_search`

`GET /api/products`'s variant-attribute (`?attributeName=`/`?attributeValue=`, `FR-CAT-071`) and
filterable-specification (`?spec[...]=`, `FR-CAT-072`) filters — and any `?q=` combined with one of
them — are served by `products.repository.ts`'s `searchPublicPaginated()`, which runs a MongoDB
**Atlas Search** `$search` aggregation against an index named **`products_search`** on the
`products` collection.

Atlas Search is an **Atlas-cluster-only** feature (a free M0 cluster, a paid tier, or a
`mongodb/mongodb-atlas-local` container — all fine). It does **not** exist on community /
self-hosted MongoDB (`mongodb://localhost`, Community Edition included). Against such a
connection the `$search` stage errors; `searchPublicPaginated()` catches that and returns
`503 SEARCH_UNAVAILABLE` rather than a raw 500.

> **Issue #322:** a standalone `GET /api/products?q=` (keyword only, no facet filter) does **not**
> use this index — it routes to `searchPublicByRegex()` (a plain case-insensitive `name`/`description`
> regex) and works on any MongoDB. The `$search` path is only reached when a variant-attribute or
> filterable-spec filter is present.

## Source of truth

`backend/src/modules/product-catalog/features/products/products.searchIndex.ts` —
`PRODUCTS_SEARCH_INDEX` (the name) and `PRODUCTS_SEARCH_INDEX_DEFINITION` (the mapping). Imported
by the repository's `$search` stage and by the provisioning script. `products-search-index.json`
in this directory mirrors it verbatim for the manual Console path below; a unit test
(`tests/products.searchIndex.test.ts`) fails if the two drift.

## Provisioning — the script (preferred, all environments)

```sh
# MONGODB_URI must point at an Atlas cluster
npm run search:ensure --workspace backend
```

`src/scripts/searchIndexes/ensureSearchIndexes.ts` — idempotent: creates `products_search` if
missing (via the Node driver's `createSearchIndex`), otherwise leaves it alone, then polls until
the index is `queryable`. Re-running is a no-op. `--force-update` re-submits the definition.

- **Local dev:** point `MONGODB_URI` at a free Atlas M0 (see `backend/.env.example`), seed data
  (`npm run seed`), then `npm run search:ensure`. `npm run search:verify` is a fast "is `$search`
  answering" check.
- **CI:** the `search.integration.test.ts` suite calls the same `ensureProductsSearchIndex()`
  against the cluster in the `ATLAS_SEARCH_TEST_URI` repo secret; it self-skips when that's unset.
- **Production:** run the compiled script against the production `MONGODB_URI` —
  `node dist/src/scripts/searchIndexes/ensureSearchIndexes.js` from a Render shell, or locally
  with `MONGODB_URI` set to the production string. `render.yaml` carries a commented
  `preDeployCommand` for when the service moves off the free plan (pre-deploy commands are
  paid-tier only).

## Provisioning — Atlas Console / CLI (alternative)

Atlas Console → cluster → **Search** → **Create Search Index** → **JSON Editor** → select the
`products` collection → paste the `definition` object from
[`products-search-index.json`](./products-search-index.json). Name it **`products_search`**.

Atlas CLI:

```sh
atlas clusters search indexes create --clusterName <cluster> --file atlas-search/products-search-index.json
```

Wait for `Active` / `queryable` before querying.

## What the index covers

`dynamic: false` throughout — only these fields are searchable/filterable:

- **`name` / `description`** (`string`) — `FR-CAT-065`'s keyword search *when combined with a
  facet filter*. `searchPublicPaginated()` uses `text` with `fuzzy: {}` (default edit-distance),
  so a close misspelling still matches.
- **`variants`** (`embeddedDocuments`: `active` + nested `attributes` `token` pairs) —
  `FR-CAT-071`'s variant-attribute filter, matched only against *active* variants.
  `embeddedDocuments` is what scopes the match to a single array element, so a `name: "Color"` +
  `value: "Red"` filter can't be satisfied by two *different* variants each carrying one half.
- **`specifications`** (`embeddedDocuments`: `groupName` + nested `values` `{name, value}`, with
  `value` mapped to `token`/`number`/`boolean` since a spec value's type varies by field) —
  `FR-CAT-072`'s filterable-specification filter, same same-element reasoning as `variants`.

The query-side operators (`embeddedDocument`, `compound`, `equals`, `range`) are built in
`products.repository.ts`'s `buildSearchFilters()` and are exercised end to end by
`backend/__tests__/product-catalog/products/search.integration.test.ts` when `ATLAS_SEARCH_TEST_URI`
is configured.
