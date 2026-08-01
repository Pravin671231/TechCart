# Atlas Search index — `products_search`

`FR-CAT-065`'s buyer keyword search (`GET /api/products?q=`) and `FR-CAT-071`/`072`'s variant-attribute/filterable-specification filters both depend on a MongoDB **Atlas Search** index that must exist on the `products` collection before those features return results. Atlas Search is an Atlas-cluster-only feature — it does not work against a local/self-hosted MongoDB (`mongodb://localhost:...`, what `backend/.env` points at in local dev), so this index can only be created once the app is pointed at a real Atlas cluster.

This directory holds the index definition as a checked-in artifact; it is **not** applied automatically by any script or migration — Atlas Search indexes are provisioned through the Atlas Console or Atlas CLI/API, not through a Mongoose connection.

## Provisioning steps

1. In the Atlas Console, open the target cluster → **Search** tab → **Create Search Index**.
2. Choose **JSON Editor**, select the `products` collection in the database this environment's `MONGODB_URI` points at.
3. Paste the contents of [`products-search-index.json`](./products-search-index.json) as the index definition. The index **must** be named `products_search` — `products.repository.ts`'s `searchPublicPaginated()` references that exact name in its `$search` aggregation stage.
4. Create the index and wait for it to finish building (Atlas shows a status of `Active` once ready — this can take a few minutes on first creation).

Equivalent via the [Atlas CLI](https://www.mongodb.com/docs/atlas/cli/current/) once authenticated and pointed at the right project/cluster:

```sh
atlas clusters search indexes create --clusterName <your-cluster-name> --file products-search-index.json
```

## What the index covers

- **`name`/`description`** (plain `string` fields) — `FR-CAT-065`'s keyword search. `searchPublicPaginated()`'s `$search` stage uses `text` with `fuzzy: {}` (default edit-distance fuzzy matching) over both paths, so a close misspelling of either still returns the intended product.
- **`variants`** (`embeddedDocuments`, containing `active` and a nested `attributes` array of `{name, value}` `token` fields) — `FR-CAT-071`'s variant-attribute filter (e.g. `Color = Red`), matched only against _active_ variants. `embeddedDocuments` is the field type Atlas Search needs to treat each array element as its own scoped document — without it, a query for `name: "Color"` and `value: "Red"` could match two _different_ variants that each happen to carry one of those values, not the same variant carrying both.
- **`specifications`** (`embeddedDocuments`, containing `groupName` and a nested `values` array of `{name, value}` fields, `value` mapped to all three of `token`/`number`/`boolean` since a specification's value type varies by field) — `FR-CAT-072`'s filterable-specification filter, same `embeddedDocuments` reasoning as `variants` above, so a `name`+`value` filter is enforced against the _same_ specification entry.

`dynamic: false` throughout — only these explicitly-mapped fields are searchable/filterable; nothing else on the document needs to be, and an unmapped field would either be ignored or (depending on Atlas's dynamic-mapping default) needlessly indexed.

**Unverified against a live cluster**: this repo has no Atlas cluster access (see "Local development" below), so the `embeddedDocuments` nesting and the query-side `embeddedDocument` operators `products.repository.ts` builds against it (see `buildSearchFilters()`) are this codebase's best-faith translation of Atlas Search's documented syntax for "array of subdocuments" exact/range matching — correct per MongoDB's own documentation, but not exercised against a real index. Test end-to-end once this index is actually provisioned.

## Local development without Atlas

Until this index is provisioned against a real cluster, `?q=`, `?attributeName=`/`?attributeValue=`, and `?spec[...]=` requests will all error at the database level (an unrecognized `$search` aggregation stage against a non-Atlas `mongodb://` connection) — any query that reaches `searchPublicPaginated()` in `products.repository.ts`. This is a known, accepted gap for local dev — every other endpoint and filter (category, brand, price range, in-stock, on-sale) works normally against `mongodb://localhost` and needs no Atlas cluster at all, since they're plain MongoDB queries (`listPublicPaginated()`).
