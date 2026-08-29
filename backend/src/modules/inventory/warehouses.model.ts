import { Schema, model } from "mongoose";

// FR-INV-001 — a small, fixed set of warehouses (2-3), not an arbitrary
// number. No status-toggle/delete guard like brands/categories — the issue's
// own scope is "no edit/delete needed for 2-3 fixed locations."
export type WarehouseDocument = {
  name: string;
  code: string;
  active: boolean;
  createdAt: Date;
};

const warehouseSchema = new Schema<WarehouseDocument>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Warehouse = model<WarehouseDocument>("Warehouse", warehouseSchema);
