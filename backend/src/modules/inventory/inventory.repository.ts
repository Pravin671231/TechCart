import { Types } from "mongoose";
import { escapeRegExp } from "@/utils/text";
import { Product } from "@/modules/product-catalog/features/products/products.model";
import { Inventory, type InventoryDocument } from "./inventory.model";

export type InventoryRecord = InventoryDocument & { _id: Types.ObjectId };

// Issue #189/M10.1 (FR-INV-002) — idempotent upsert: a variant needs one
// stock:0 row per *active* warehouse. Called once, right after a new variant
// is persisted (products.service.ts's addVariant) and once per new warehouse
// (warehouses.service.ts's createWarehouse) — the two points that can ever
// create a gap in "every (variant, warehouse) pair has a row."
export async function ensureRowsForVariant(
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  warehouseIds: Types.ObjectId[],
): Promise<void> {
  if (warehouseIds.length === 0) return;
  await Promise.all(
    warehouseIds.map((warehouseId) =>
      Inventory.updateOne(
        { variantId, warehouseId },
        { $setOnInsert: { productId, variantId, warehouseId, stock: 0 } },
        { upsert: true },
      ),
    ),
  );
}

export async function ensureRowsForWarehouse(
  warehouseId: Types.ObjectId,
  variants: { productId: Types.ObjectId; variantId: Types.ObjectId }[],
): Promise<void> {
  if (variants.length === 0) return;
  await Promise.all(
    variants.map(({ productId, variantId }) =>
      Inventory.updateOne(
        { variantId, warehouseId },
        { $setOnInsert: { productId, variantId, warehouseId, stock: 0 } },
        { upsert: true },
      ),
    ),
  );
}

export type InventoryListFilter = {
  warehouseId?: Types.ObjectId;
  search?: string;
};

export type InventoryListPage = { page: number; limit: number };

// FR-INV-004 — search matches at the *product* level (name or any variant's
// sku): a match includes every row for that product, not just the one
// sku-matching variant. A deliberate simplification over a full per-variant
// join, consistent with this table's own small scale.
export async function listPaginated(
  filter: InventoryListFilter,
  page: InventoryListPage,
): Promise<{ items: InventoryRecord[]; total: number }> {
  const mongoFilter: Record<string, unknown> = {};
  if (filter.warehouseId) mongoFilter.warehouseId = filter.warehouseId;

  if (filter.search) {
    const escaped = escapeRegExp(filter.search);
    const matchingProducts = await Product.find(
      { $or: [{ name: { $regex: escaped, $options: "i" } }, { "variants.sku": { $regex: escaped, $options: "i" } }] },
      { _id: 1 },
    ).lean();
    mongoFilter.productId = { $in: matchingProducts.map((product) => product._id) };
  }

  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Inventory.find(mongoFilter).sort({ productId: 1 }).skip(skip).limit(page.limit).lean(),
    Inventory.countDocuments(mongoFilter),
  ]);
  return { items, total };
}

export async function findById(id: Types.ObjectId): Promise<InventoryRecord | null> {
  return Inventory.findById(id).lean();
}

// FR-INV-005/006 — a plain absolute update; the negative-value rejection
// itself happens in inventory.service.ts (before this is ever called), since
// that's where the NEGATIVE_STOCK_REJECTED error code is thrown.
export async function setStock(
  id: Types.ObjectId,
  stock: number,
): Promise<InventoryRecord | null> {
  return Inventory.findByIdAndUpdate(id, { $set: { stock } }, { new: true }).lean();
}

// Batched — one aggregate per result page, same "bulk map, default missing
// key to 0" shape as products.repository.ts's countByBrandIds/countByCategoryIds.
export async function sumStockByVariantIds(
  variantIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map();
  const results = await Inventory.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { variantId: { $in: variantIds } } },
    { $group: { _id: "$variantId", total: { $sum: "$stock" } } },
  ]);
  return new Map(results.map((row) => [row._id.toString(), row.total]));
}

// FR-DASH-style "?inStock=true" buyer filter — every variant id with
// summed stock > 0 across all warehouses. Cheap at this collection's small
// scale (a handful of warehouses × the product catalog's own variant count).
export async function listVariantIdsWithStock(): Promise<Types.ObjectId[]> {
  const results = await Inventory.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $group: { _id: "$variantId", total: { $sum: "$stock" } } },
    { $match: { total: { $gt: 0 } } },
  ]);
  return results.map((row) => row._id);
}

// FR-INV-009 — one atomic attempt at exactly one warehouse: succeeds (and
// decrements) only if that warehouse's stock is already >= quantity. Callers
// try warehouses in order and stop at the first success; each attempt is
// independently atomic, so trying several in sequence is race-safe (no two
// concurrent requests can both succeed against the same warehouse for more
// than its available stock).
export async function allocateAtWarehouse(
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  quantity: number,
): Promise<boolean> {
  const result = await Inventory.updateOne(
    { variantId, warehouseId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
  );
  return result.modifiedCount === 1;
}

// FR-INV-011 — always succeeds (restoring stock has no lower bound to
// violate); used on quantity-decrease, line removal, and cart clear.
export async function restoreAtWarehouse(
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  quantity: number,
): Promise<void> {
  await Inventory.updateOne({ variantId, warehouseId }, { $inc: { stock: quantity } });
}

export async function getStockAtWarehouse(
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
): Promise<number> {
  const row = await Inventory.findOne({ variantId, warehouseId }, { stock: 1 }).lean();
  return row?.stock ?? 0;
}

// FR-INV-010 — "naming the largest available single-warehouse quantity"
// when a brand-new line's allocation fails everywhere.
export async function maxStockForVariant(variantId: Types.ObjectId): Promise<number> {
  const rows = await Inventory.find({ variantId }, { stock: 1 }).lean();
  return rows.reduce((max, row) => Math.max(max, row.stock), 0);
}
