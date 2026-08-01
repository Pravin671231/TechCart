# Atlas Search index — `products_search`

`FR-CAT-065`'s buyer keyword search (`GET /api/products?q=`) depends on a MongoDB **Atlas Search** index that must exist on the `products` collection before that endpoint returns results. Atlas Search is an Atlas-cluster-only feature — it does not work against a local/self-hosted MongoDB (`mongodb://localhost:...`, what `backend/.env` points at in local dev), so this index can only be created once the app is pointed at a real Atlas cluster.

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

`dynamic: false` with explicit `name`/`description` fields — matches exactly what `FR-CAT-065` asks for ("matching product name and description") and nothing else; no other field needs to be search-indexed. `searchPublicPaginated()`'s `$search` stage uses `text` with `fuzzy: {}` (default edit-distance fuzzy matching) over both paths, so a close misspelling of either still returns the intended product.

## Local development without Atlas

Until this index is provisioned against a real cluster, `?q=` requests will error at the database level (an unrecognized `$search` aggregation stage against a non-Atlas `mongodb://` connection). This is a known, accepted gap for local dev — every other endpoint in this module works normally against `mongodb://localhost` and needs no Atlas cluster at all.
