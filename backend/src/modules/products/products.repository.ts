import type { Types } from "mongoose";
import { Product } from "./products.model";

// Only what brands (#27) needs: a per-brand delete guard and a bulk count for
// the admin list. No other product queries exist yet — #31 owns the rest.

export async function countByBrand(brandId: Types.ObjectId): Promise<number> {
  return Product.countDocuments({ brand: brandId });
}

/**
 * Bulk per-brand counts for the admin brand list, in one aggregation instead
 * of N queries. Brands with zero products simply don't appear in the map —
 * callers should default to 0 for any id missing from it.
 */
export async function countByBrandIds(
  brandIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  const results = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { brand: { $in: brandIds } } },
    { $group: { _id: "$brand", count: { $sum: 1 } } },
  ]);

  return new Map(results.map((r) => [r._id.toString(), r.count]));
}
