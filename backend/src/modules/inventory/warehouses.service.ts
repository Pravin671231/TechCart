import { AppError } from "@/utils/AppError";
import * as warehousesRepository from "./warehouses.repository";
import type { WarehouseRecord } from "./warehouses.repository";
import { ensureInventoryRowsForWarehouse } from "./inventory.service";

export type CreateWarehouseInput = {
  name: string;
  code: string;
};

export async function createWarehouse(input: CreateWarehouseInput): Promise<WarehouseRecord> {
  if (await warehousesRepository.codeExists(input.code)) {
    throw new AppError(400, "DUPLICATE_WAREHOUSE_CODE", `Code "${input.code}" is already in use.`);
  }

  const warehouse = await warehousesRepository.create(input);
  // FR-INV-002 — every (variant, warehouse) pair must have a row; a brand
  // new warehouse needs a stock:0 row for every existing variant across
  // every product, not just future ones.
  await ensureInventoryRowsForWarehouse(warehouse._id);
  return warehouse;
}

export async function listWarehouses(): Promise<WarehouseRecord[]> {
  return warehousesRepository.listAll();
}
