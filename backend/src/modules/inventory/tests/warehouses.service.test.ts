import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WarehouseRecord } from "../warehouses.repository";

vi.mock("../warehouses.repository", () => ({
  create: vi.fn(),
  codeExists: vi.fn(),
  listAll: vi.fn(),
  listActiveOrderedByCreation: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../inventory.service", () => ({
  ensureInventoryRowsForWarehouse: vi.fn(),
}));

import * as warehousesRepository from "../warehouses.repository";
import { ensureInventoryRowsForWarehouse } from "../inventory.service";
import { createWarehouse, listWarehouses } from "../warehouses.service";

const warehouseId = new Types.ObjectId();

const warehouseA: WarehouseRecord = {
  _id: warehouseId,
  name: "Mumbai Warehouse",
  code: "MUM",
  active: true,
  createdAt: new Date(),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("createWarehouse", () => {
  it("throws DUPLICATE_WAREHOUSE_CODE when the code is already in use", async () => {
    vi.mocked(warehousesRepository.codeExists).mockResolvedValue(true);

    await expect(createWarehouse({ name: "Mumbai", code: "MUM" })).rejects.toMatchObject({
      statusCode: 400,
      code: "DUPLICATE_WAREHOUSE_CODE",
    });
    expect(warehousesRepository.create).not.toHaveBeenCalled();
  });

  it("creates the warehouse and backfills inventory rows for every existing variant", async () => {
    vi.mocked(warehousesRepository.codeExists).mockResolvedValue(false);
    vi.mocked(warehousesRepository.create).mockResolvedValue(warehouseA);

    const result = await createWarehouse({ name: "Mumbai Warehouse", code: "MUM" });

    expect(result).toEqual(warehouseA);
    expect(ensureInventoryRowsForWarehouse).toHaveBeenCalledWith(warehouseId);
  });
});

describe("listWarehouses", () => {
  it("returns the full unpaginated list", async () => {
    vi.mocked(warehousesRepository.listAll).mockResolvedValue([warehouseA]);

    const result = await listWarehouses();

    expect(result).toEqual([warehouseA]);
  });
});
