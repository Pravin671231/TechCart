import type { Types } from "mongoose";
import { Warehouse, type WarehouseDocument } from "./warehouses.model";

export type WarehouseRecord = WarehouseDocument & { _id: Types.ObjectId };

export type CreateWarehouseDoc = {
  name: string;
  code: string;
};

export async function create(doc: CreateWarehouseDoc): Promise<WarehouseRecord> {
  const warehouse = await Warehouse.create(doc);
  return warehouse.toObject();
}

export async function codeExists(code: string): Promise<boolean> {
  const existing = await Warehouse.exists({ code });
  return existing !== null;
}

export async function listAll(): Promise<WarehouseRecord[]> {
  return Warehouse.find().sort({ createdAt: 1 }).lean();
}

// FR-INV-009 — "first warehouse with enough stock, by creation order" reads
// this exact ordering. Active only — a deactivated warehouse (if this app
// ever adds that toggle) shouldn't receive new allocations.
export async function listActiveOrderedByCreation(): Promise<WarehouseRecord[]> {
  return Warehouse.find({ active: true }).sort({ createdAt: 1 }).lean();
}

export async function findById(id: Types.ObjectId): Promise<WarehouseRecord | null> {
  return Warehouse.findById(id).lean();
}
