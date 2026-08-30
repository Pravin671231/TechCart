// CLI entry point for warehouse + inventory seed data (Issue #330) — run with
// `npm run seed:inventory --workspace backend`. Idempotent, matching
// upsert.ts's/seedUsers.ts's precedent over run.ts's destructive full-reset
// one; safe to re-run repeatedly with no duplicates.
//
// Must run after the catalog seed (seed:upsert) — it enumerates every
// existing product's variants to build inventory rows for. Deliberately does
// NOT route through warehouses.service.ts's createWarehouse()/
// inventory.service.ts's ensureInventoryRowsForWarehouse() — both always
// upsert a stock:0 row (see inventory.repository.ts's ensureRowsForVariant/
// ensureRowsForWarehouse), which this script would just immediately
// overwrite. A direct find-or-create (warehouses.repository.ts, reused
// as-is) + a direct stock-carrying upsert against the Inventory model is
// simpler.
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { Inventory } from "@/modules/inventory/inventory.model";
import * as warehousesRepository from "@/modules/inventory/warehouses.repository";
import type { WarehouseRecord } from "@/modules/inventory/warehouses.repository";
import { listAllVariantRefs } from "@/modules/product-catalog/features/products/products.repository";

// A small, fixed set (FR-INV-001) — created sequentially, never in parallel,
// so createdAt strictly increases and warehousesRepository's own
// listActiveOrderedByCreation() (which cart allocation shops in order) always
// returns them WH-PRIMARY, WH-SECONDARY, WH-RETURNS.
const SEED_WAREHOUSES = [
  { name: "Primary Warehouse", code: "WH-PRIMARY" },
  { name: "Secondary Warehouse", code: "WH-SECONDARY" },
  { name: "Returns Warehouse", code: "WH-RETURNS" },
] as const;

async function findOrCreateWarehouse(input: {
  name: string;
  code: string;
}): Promise<WarehouseRecord> {
  if (!(await warehousesRepository.codeExists(input.code))) {
    const created = await warehousesRepository.create(input);
    console.log(`Created warehouse: ${created.code}`);
    return created;
  }
  const existing = (await warehousesRepository.listAll()).find((w) => w.code === input.code);
  console.log(`Warehouse already existed: ${input.code}`);
  return existing!;
}

// Deterministic stock plan keyed on array index (not randomness, not variant
// id — variant ids regenerate on every seed:upsert run per this codebase's
// own documented Seeding convention, but the product/variant ORDER seed:upsert
// produces is stable). Exported for a light smoke test (Issue #330's own
// "optionally a light smoke test for any pure helper" precedent).
export type StockPlan = { primary: number; secondary: number; returns: number };

export function planStockForIndex(i: number): StockPlan {
  const bucket = i % 10;
  if (bucket === 0) return { primary: 0, secondary: 0, returns: 0 }; // fully out of stock (~10%)
  if (bucket === 1) return { primary: 0, secondary: 40, returns: 0 }; // single-warehouse only, not primary
  if (bucket === 2) return { primary: 0, secondary: 0, returns: 25 }; // single-warehouse only, last warehouse
  return { primary: 100, secondary: 40, returns: 15 }; // normal case (~70%)
}

async function upsertRow(
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  stock: number,
): Promise<void> {
  // $set on the existing unique {variantId, warehouseId} index — re-running
  // always converges to the same value, no duplicates possible.
  await Inventory.updateOne(
    { variantId, warehouseId },
    { $set: { productId, variantId, warehouseId, stock } },
    { upsert: true },
  );
}

export async function runSeedInventory(): Promise<void> {
  const warehouses: WarehouseRecord[] = [];
  for (const warehouse of SEED_WAREHOUSES) {
    warehouses.push(await findOrCreateWarehouse(warehouse));
  }
  const [primary, secondary, returns] = warehouses;

  const variantRefs = await listAllVariantRefs();
  console.log(`Seeding inventory for ${variantRefs.length} variant(s)...`);

  let rowCount = 0;
  for (let i = 0; i < variantRefs.length; i += 1) {
    const { productId, variantId } = variantRefs[i]!;
    const plan = planStockForIndex(i);
    await upsertRow(productId, variantId, primary!._id, plan.primary);
    await upsertRow(productId, variantId, secondary!._id, plan.secondary);
    await upsertRow(productId, variantId, returns!._id, plan.returns);
    rowCount += 3;
  }

  console.log(`Inventory seed complete: ${warehouses.length} warehouse(s), ${rowCount} row(s).`);
}

if (require.main === module) {
  connectDB()
    .then(runSeedInventory)
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:inventory failed:", error);
      process.exit(1);
    });
}
