# Load test — buyer catalog endpoints (`FR-NFR-BE-005`)

A [k6](https://k6.io) script that drives the three highest-traffic buyer
endpoints at 50 concurrent virtual users for one minute and fails the run if
p95 latency exceeds the **300 ms** target (`FR-NFR-BE-001`):

| weight | endpoint | group |
| --- | --- | --- |
| 55% | `GET /api/products?page=<1..20>&sort=recommended` | `listing` |
| 25% | `GET /api/products/:slug` | `detail` |
| 20% | `GET /api/products?q=<keyword>` | `search` |

This is a **developer tool** — it is not part of the deployed app, not run
in CI, and not automated. Run it by hand when you want to measure.

## Prerequisites

1. **Install k6** (standalone binary, not an npm package):
   - Windows: `winget install k6.k6` or `choco install k6`
   - macOS: `brew install k6`
   - Linux / other: <https://grafana.com/docs/k6/latest/set-up/install-k6/>

2. **A throwaway database.** The bulk seed writes ~5,000 products and
   ~10,000 orders. Point `MONGODB_URI` at a dedicated database — never your
   normal dev data:

   ```bash
   # from the repo root
   MONGODB_URI=mongodb://localhost:27017/techcart-loadtest \
     npm run seed:load-test --workspace backend -- --products=5000 --orders=10000
   ```

   The seed refuses to run with `NODE_ENV=production` or against a
   non-localhost host (pass `--force` to override). Every document it writes
   is prefixed (`load-*` slugs, `LOAD-*` skus/order numbers), and it deletes
   its own prior output first, so it is safe to re-run.

3. **Start the backend against that same database:**

   ```bash
   MONGODB_URI=mongodb://localhost:27017/techcart-loadtest \
     npm run dev --workspace backend
   ```

## Run

```bash
k6 run backend/load-test/products.js
# custom target:
k6 run -e BASE_URL=http://localhost:4000 backend/load-test/products.js
```

## Read the output

k6 prints a summary table. The lines that matter:

- `http_req_duration{group:::listing}` / `{group:::detail}` / `{group:::search}`
  — the `p(95)` column for each is what the 300 ms threshold checks.
- `http_req_failed` — must stay under 1%.
- `✓ / ✗` next to each threshold at the bottom — a `✗` means that group
  missed 300 ms and k6 exits non-zero.

Record the numbers in `backend/docs/architecture.md` → **Performance** →
*Recorded baseline*.

## Clean up

```bash
mongosh techcart-loadtest --eval 'db.dropDatabase()'
```
