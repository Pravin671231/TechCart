import type { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import {
  listAllVariantRefs,
  findByIds as findProductsByIds,
} from "@/modules/product-catalog/features/products/products.repository";
import * as warehousesRepository from "./warehouses.repository";
import * as inventoryRepository from "./inventory.repository";
import type { InventoryRecord } from "./inventory.repository";

// Issue #189/M10.1 (FR-INV-002) — a new variant needs one stock:0 row per
// *active* warehouse. Called right after a variant is persisted
// (products.service.ts's addVariant) — the other gap-creating point,
// a brand-new warehouse, is ensureInventoryRowsForWarehouse below.
export async function ensureInventoryRowsForVariant(
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
): Promise<void> {
  const warehouses = await warehousesRepository.listActiveOrderedByCreation();
  await inventoryRepository.ensureRowsForVariant(
    productId,
    variantId,
    warehouses.map((warehouse) => warehouse._id),
  );
}

// A brand new warehouse needs a stock:0 row for every existing variant
// across every product, not just future ones — listAllVariantRefs is a
// peer repository import from products.repository.ts (this codebase's
// established cross-module convention), not a new Product-model reach.
export async function ensureInventoryRowsForWarehouse(warehouseId: Types.ObjectId): Promise<void> {
  const variants = await listAllVariantRefs();
  await inventoryRepository.ensureRowsForWarehouse(warehouseId, variants);
}

export type InventoryListFilter = inventoryRepository.InventoryListFilter;

// FR-INV-004 — the admin table shows product name + variant sku + warehouse
// name, not raw ids. Three small batched lookups (products, warehouses),
// mirroring products.service.ts's attachCardSpecifications enrichment shape,
// rather than a heavier aggregation $lookup pipeline.
export type InventoryListItem = {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  variantId: Types.ObjectId;
  variantSku: string;
  warehouseId: Types.ObjectId;
  warehouseName: string;
  stock: number;
};

export async function getInventoryList(
  filter: InventoryListFilter,
  page: { page: number; limit: number },
): Promise<{ items: InventoryListItem[]; total: number }> {
  const { items, total } = await inventoryRepository.listPaginated(filter, page);

  const productIds = [...new Map(items.map((item) => [item.productId.toString(), item.productId])).values()];
  const warehouseIds = [
    ...new Map(items.map((item) => [item.warehouseId.toString(), item.warehouseId])).values(),
  ];
  const [products, warehouses] = await Promise.all([
    findProductsByIds(productIds),
    Promise.all(warehouseIds.map((id) => warehousesRepository.findById(id))),
  ]);

  const productsById = new Map(products.map((product) => [product._id.toString(), product]));
  const warehousesById = new Map(
    warehouses.filter((warehouse) => warehouse !== null).map((warehouse) => [warehouse._id.toString(), warehouse]),
  );

  const enriched = items.map((item): InventoryListItem => {
    const product = productsById.get(item.productId.toString());
    const variant = product?.variants.find((v) => v._id.toString() === item.variantId.toString());
    const warehouse = warehousesById.get(item.warehouseId.toString());
    return {
      _id: item._id,
      productId: item.productId,
      productName: product?.name ?? "Unknown product",
      variantId: item.variantId,
      variantSku: variant?.sku ?? "Unknown SKU",
      warehouseId: item.warehouseId,
      warehouseName: warehouse?.name ?? "Unknown warehouse",
      stock: item.stock,
    };
  });

  return { items: enriched, total };
}

// FR-INV-005/006 — non-negative, service-level so the rejection carries the
// SRS's own named code (a bare Zod .min(0) failure would surface as the
// generic VALIDATION_ERROR shape instead).
export async function updateStock(
  id: Types.ObjectId,
  stock: number,
): Promise<InventoryRecord> {
  if (stock < 0) {
    throw new AppError(400, "NEGATIVE_STOCK_REJECTED", "Stock cannot be set to a negative value.");
  }
  const existing = await inventoryRepository.findById(id);
  if (!existing) {
    throw new AppError(404, "INVENTORY_ROW_NOT_FOUND", "Inventory record not found.");
  }
  const updated = await inventoryRepository.setStock(id, stock);
  if (!updated) {
    throw new AppError(404, "INVENTORY_ROW_NOT_FOUND", "Inventory record not found.");
  }
  return updated;
}

export async function sumStockByVariantIds(variantIds: Types.ObjectId[]): Promise<Map<string, number>> {
  return inventoryRepository.sumStockByVariantIds(variantIds);
}

export async function listVariantIdsWithStock(): Promise<Types.ObjectId[]> {
  return inventoryRepository.listVariantIdsWithStock();
}

// FR-INV-009 — a brand-new cart line: try each active warehouse in creation
// order, stopping at the first one whose stock covers the full quantity. No
// cross-warehouse splitting (the SRS is explicit one line lives at exactly
// one warehouse). Returns the winning warehouse id, or throws
// INSUFFICIENT_STOCK naming the largest single-warehouse quantity available
// (FR-INV-010) — including the case where total stock is 0 (FR-INV-008).
export async function allocateNewLine(
  variantId: Types.ObjectId,
  quantity: number,
): Promise<Types.ObjectId> {
  const warehouses = await warehousesRepository.listActiveOrderedByCreation();
  for (const warehouse of warehouses) {
    const allocated = await inventoryRepository.allocateAtWarehouse(variantId, warehouse._id, quantity);
    if (allocated) return warehouse._id;
  }
  const maxAvailable = await inventoryRepository.maxStockForVariant(variantId);
  throw new AppError(
    409,
    "INSUFFICIENT_STOCK",
    maxAvailable > 0
      ? `Only ${maxAvailable} unit(s) available for this item.`
      : "This item is currently out of stock.",
  );
}

// FR-INV-011 — an existing line's quantity increases: re-check only the
// warehouse already recorded on that line, never re-shop other warehouses.
export async function allocateAdditionalStock(
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  additionalQuantity: number,
): Promise<void> {
  const allocated = await inventoryRepository.allocateAtWarehouse(variantId, warehouseId, additionalQuantity);
  if (!allocated) {
    const available = await inventoryRepository.getStockAtWarehouse(variantId, warehouseId);
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Only ${available} more unit(s) available for this item.`,
    );
  }
}

// FR-INV-011 — quantity decrease, line removal, or cart clear: always
// succeeds, no lower bound to violate.
export async function restoreStock(
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  await inventoryRepository.restoreAtWarehouse(variantId, warehouseId, quantity);
}
