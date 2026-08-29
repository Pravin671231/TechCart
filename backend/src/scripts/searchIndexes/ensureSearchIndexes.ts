// Idempotent provisioning of the Atlas Search index the buyer listing's
// variant-attribute / filterable-specification filters depend on (see
// products.repository.ts's searchPublicPaginated). Run with:
//
//   npm run search:ensure --workspace backend
//
// against whatever cluster MONGODB_URI points at — a free Atlas M0 for local
// dev / CI, the real Atlas cluster in production. Safe to re-run: an existing,
// up-to-date index is left alone. `$search` and the search-index management
// commands only exist on MongoDB Atlas (and Atlas Local) — not community /
// self-hosted MongoDB.
//
// Definition source of truth: products.searchIndex.ts (mirrored in
// backend/atlas-search/products-search-index.json for manual Console use).
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import {
  PRODUCTS_SEARCH_INDEX,
  PRODUCTS_SEARCH_INDEX_DEFINITION,
} from "@/modules/product-catalog/features/products/products.searchIndex";

const COLLECTION = "products";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

type SearchIndexInfo = {
  name: string;
  status?: string;
  queryable?: boolean;
  latestDefinition?: { mappings?: unknown };
};

function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active MongoDB connection — call connectDB() first.");
  return db;
}

async function listProductsSearchIndexes(): Promise<SearchIndexInfo[]> {
  try {
    return (await getDb()
      .collection(COLLECTION)
      .listSearchIndexes(PRODUCTS_SEARCH_INDEX)
      .toArray()) as SearchIndexInfo[];
  } catch (error) {
    console.error(
      "\nFailed to query Atlas Search indexes. Atlas Search is only available on a\n" +
        "MongoDB Atlas cluster (a free M0 works) or Atlas Local — never against\n" +
        "community / self-hosted MongoDB. Point MONGODB_URI at an Atlas connection string.\n",
    );
    throw error;
  }
}

async function waitUntilQueryable(): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const [info] = await listProductsSearchIndexes();
    if (info?.queryable) {
      console.log(`Atlas Search index "${PRODUCTS_SEARCH_INDEX}" is queryable.`);
      return;
    }
    console.log(
      `  building… status=${info?.status ?? "unknown"} queryable=${String(info?.queryable ?? false)}`,
    );
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for "${PRODUCTS_SEARCH_INDEX}" to become queryable.`,
  );
}

// Operates on the already-open mongoose connection (the CLI wrapper below owns
// connect/disconnect; the integration test calls this after its own bootstrap).
// Pass { forceUpdate: true } to re-submit the definition even when an index of
// the same name already exists — Atlas may normalise a stored definition
// (e.g. adding token-analyzer defaults), so the "definition changed" check is
// best-effort and a deliberate no-op by default to keep re-runs predictable.
export async function ensureProductsSearchIndex(
  options: { forceUpdate?: boolean } = {},
): Promise<void> {
  const collection = getDb().collection(COLLECTION);
  const [existing] = await listProductsSearchIndexes();

  if (!existing) {
    console.log(`Creating Atlas Search index "${PRODUCTS_SEARCH_INDEX}" on "${COLLECTION}"…`);
    await collection.createSearchIndex({
      name: PRODUCTS_SEARCH_INDEX,
      definition: PRODUCTS_SEARCH_INDEX_DEFINITION,
    });
  } else {
    const changed = !isDeepStrictEqual(
      existing.latestDefinition?.mappings,
      JSON.parse(JSON.stringify(PRODUCTS_SEARCH_INDEX_DEFINITION.mappings)),
    );
    if (options.forceUpdate || changed) {
      if (changed && !options.forceUpdate) {
        console.log(
          `Atlas Search index "${PRODUCTS_SEARCH_INDEX}" definition differs from the stored one — updating.`,
        );
      } else {
        console.log(`Updating Atlas Search index "${PRODUCTS_SEARCH_INDEX}" (forced)…`);
      }
      await collection.updateSearchIndex(PRODUCTS_SEARCH_INDEX, PRODUCTS_SEARCH_INDEX_DEFINITION);
    } else {
      console.log(`Atlas Search index "${PRODUCTS_SEARCH_INDEX}" already provisioned.`);
    }
  }

  await waitUntilQueryable();
}

export async function runEnsureSearchIndexes(): Promise<void> {
  await connectDB();
  try {
    await ensureProductsSearchIndex({ forceUpdate: process.argv.includes("--force-update") });
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runEnsureSearchIndexes().catch((error: unknown) => {
    console.error("search:ensure failed:", error);
    process.exit(1);
  });
}
