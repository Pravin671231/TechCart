import { Schema, model, type Types } from "mongoose";

// FR-INV-003 — one row per (variant, warehouse) pair. `productId` is
// denormalized (not derivable from `variantId` alone without a lookup)
// purely to make the admin table query cheap — it's never the source of
// truth for which product a variant belongs to.
export type InventoryDocument = {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  warehouseId: Types.ObjectId;
  stock: number;
};

const inventorySchema = new Schema<InventoryDocument>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
  stock: { type: Number, required: true, default: 0, min: 0 },
});

// FR-INV-002 — no unassigned/duplicate stock: exactly one row per
// (variantId, warehouseId) pair.
inventorySchema.index({ variantId: 1, warehouseId: 1 }, { unique: true });
// Supports the admin table's own lookup and warehouse filter.
inventorySchema.index({ warehouseId: 1 });

export const Inventory = model<InventoryDocument>("Inventory", inventorySchema);
