// Fast smoke check that Atlas Search is actually answering against whatever
// cluster MONGODB_URI points at. Run with:
//
//   npm run search:verify --workspace backend
//
// Runs one minimal `$search` query on the products collection and prints how
// many documents the products_search index has picked up — a quick post-deploy
// / post-`search:ensure` confirmation, distinct from the CI integration test.
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { PRODUCTS_SEARCH_INDEX } from "@/modules/product-catalog/features/products/products.searchIndex";

export async function countIndexedProducts(): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No active MongoDB connection — call connectDB() first.");

  const [result] = await db
    .collection("products")
    .aggregate([
      { $search: { index: PRODUCTS_SEARCH_INDEX, exists: { path: "name" } } },
      { $count: "indexed" },
    ])
    .toArray();

  return (result?.["indexed"] as number | undefined) ?? 0;
}

if (require.main === module) {
  (async () => {
    await connectDB();
    try {
      const indexed = await countIndexedProducts();
      console.log(
        `Atlas Search index "${PRODUCTS_SEARCH_INDEX}" responded — ${indexed} product(s) indexed.`,
      );
    } finally {
      await disconnectDB();
    }
  })().catch((error: unknown) => {
    console.error("search:verify failed:", error);
    process.exit(1);
  });
}
