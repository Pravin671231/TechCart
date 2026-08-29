import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryRecord } from "../inventory.repository";
import type { WarehouseRecord } from "../warehouses.repository";

vi.mock("../inventory.repository", () => ({
  ensureRowsForVariant: vi.fn(),
  ensureRowsForWarehouse: vi.fn(),
  listPaginated: vi.fn(),
  findById: vi.fn(),
  setStock: vi.fn(),
  sumStockByVariantIds: vi.fn(),
  listVariantIdsWithStock: vi.fn(),
  allocateAtWarehouse: vi.fn(),
  restoreAtWarehouse: vi.fn(),
  getStockAtWarehouse: vi.fn(),
  maxStockForVariant: vi.fn(),
}));

vi.mock("../warehouses.repository", () => ({
  listActiveOrderedByCreation: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/modules/product-catalog/features/products/products.repository", () => ({
  listAllVariantRefs: vi.fn(),
  findByIds: vi.fn(),
}));

import * as inventoryRepository from "../inventory.repository";
import * as warehousesRepository from "../warehouses.repository";
import * as productsRepository from "@/modules/product-catalog/features/products/products.repository";
import {
  ensureInventoryRowsForVariant,
  ensureInventoryRowsForWarehouse,
  updateStock,
  allocateNewLine,
  allocateAdditionalStock,
  restoreStock,
  getInventoryList,
} from "../inventory.service";

const productId = new Types.ObjectId();
const variantId = new Types.ObjectId();
const warehouseA = new Types.ObjectId();
const warehouseB = new Types.ObjectId();

afterEach(() => {
  vi.clearAllMocks();
});

describe("ensureInventoryRowsForVariant", () => {
  it("creates a row for every active warehouse", async () => {
    const warehouses: WarehouseRecord[] = [
      { _id: warehouseA, name: "A", code: "A", active: true, createdAt: new Date() },
      { _id: warehouseB, name: "B", code: "B", active: true, createdAt: new Date() },
    ];
    vi.mocked(warehousesRepository.listActiveOrderedByCreation).mockResolvedValue(warehouses);

    await ensureInventoryRowsForVariant(productId, variantId);

    expect(inventoryRepository.ensureRowsForVariant).toHaveBeenCalledWith(productId, variantId, [
      warehouseA,
      warehouseB,
    ]);
  });
});

describe("ensureInventoryRowsForWarehouse", () => {
  it("creates a row for every existing variant across every product", async () => {
    const refs = [{ productId, variantId }];
    vi.mocked(productsRepository.listAllVariantRefs).mockResolvedValue(refs);

    await ensureInventoryRowsForWarehouse(warehouseA);

    expect(inventoryRepository.ensureRowsForWarehouse).toHaveBeenCalledWith(warehouseA, refs);
  });
});

describe("updateStock", () => {
  const inventoryId = new Types.ObjectId();
  const record: InventoryRecord = { _id: inventoryId, productId, variantId, warehouseId: warehouseA, stock: 5 };

  it("throws NEGATIVE_STOCK_REJECTED for a negative value without touching the repository", async () => {
    await expect(updateStock(inventoryId, -1)).rejects.toMatchObject({
      statusCode: 400,
      code: "NEGATIVE_STOCK_REJECTED",
    });
    expect(inventoryRepository.setStock).not.toHaveBeenCalled();
  });

  it("throws INVENTORY_ROW_NOT_FOUND when the row doesn't exist", async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(null);

    await expect(updateStock(inventoryId, 5)).rejects.toMatchObject({
      statusCode: 404,
      code: "INVENTORY_ROW_NOT_FOUND",
    });
  });

  it("updates the stock when valid", async () => {
    vi.mocked(inventoryRepository.findById).mockResolvedValue(record);
    vi.mocked(inventoryRepository.setStock).mockResolvedValue({ ...record, stock: 9 });

    const result = await updateStock(inventoryId, 9);

    expect(inventoryRepository.setStock).toHaveBeenCalledWith(inventoryId, 9);
    expect(result.stock).toBe(9);
  });
});

describe("allocateNewLine", () => {
  it("returns the first warehouse whose allocation succeeds", async () => {
    vi.mocked(warehousesRepository.listActiveOrderedByCreation).mockResolvedValue([
      { _id: warehouseA, name: "A", code: "A", active: true, createdAt: new Date() },
      { _id: warehouseB, name: "B", code: "B", active: true, createdAt: new Date() },
    ]);
    vi.mocked(inventoryRepository.allocateAtWarehouse).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await allocateNewLine(variantId, 2);

    expect(result).toEqual(warehouseB);
    expect(inventoryRepository.allocateAtWarehouse).toHaveBeenCalledTimes(2);
  });

  it("throws INSUFFICIENT_STOCK naming the max available when no warehouse has enough", async () => {
    vi.mocked(warehousesRepository.listActiveOrderedByCreation).mockResolvedValue([
      { _id: warehouseA, name: "A", code: "A", active: true, createdAt: new Date() },
    ]);
    vi.mocked(inventoryRepository.allocateAtWarehouse).mockResolvedValue(false);
    vi.mocked(inventoryRepository.maxStockForVariant).mockResolvedValue(3);

    await expect(allocateNewLine(variantId, 5)).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
      message: expect.stringContaining("3"),
    });
  });

  it("throws INSUFFICIENT_STOCK with an out-of-stock message when total stock is 0", async () => {
    vi.mocked(warehousesRepository.listActiveOrderedByCreation).mockResolvedValue([]);
    vi.mocked(inventoryRepository.maxStockForVariant).mockResolvedValue(0);

    await expect(allocateNewLine(variantId, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
      message: expect.stringContaining("out of stock"),
    });
  });
});

describe("allocateAdditionalStock", () => {
  it("succeeds when the recorded warehouse has enough stock", async () => {
    vi.mocked(inventoryRepository.allocateAtWarehouse).mockResolvedValue(true);

    await allocateAdditionalStock(variantId, warehouseA, 2);

    expect(inventoryRepository.allocateAtWarehouse).toHaveBeenCalledWith(variantId, warehouseA, 2);
  });

  it("throws INSUFFICIENT_STOCK naming what's left at that one warehouse, never checking others", async () => {
    vi.mocked(inventoryRepository.allocateAtWarehouse).mockResolvedValue(false);
    vi.mocked(inventoryRepository.getStockAtWarehouse).mockResolvedValue(1);

    await expect(allocateAdditionalStock(variantId, warehouseA, 5)).rejects.toMatchObject({
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
      message: expect.stringContaining("1"),
    });
  });
});

describe("restoreStock", () => {
  it("restores the given quantity at the recorded warehouse", async () => {
    await restoreStock(variantId, warehouseA, 3);

    expect(inventoryRepository.restoreAtWarehouse).toHaveBeenCalledWith(variantId, warehouseA, 3);
  });

  it("is a no-op for a zero or negative quantity", async () => {
    await restoreStock(variantId, warehouseA, 0);

    expect(inventoryRepository.restoreAtWarehouse).not.toHaveBeenCalled();
  });
});

describe("getInventoryList", () => {
  it("enriches each row with product name, variant sku, and warehouse name", async () => {
    const inventoryId = new Types.ObjectId();
    vi.mocked(inventoryRepository.listPaginated).mockResolvedValue({
      items: [{ _id: inventoryId, productId, variantId, warehouseId: warehouseA, stock: 4 }],
      total: 1,
    });
    vi.mocked(productsRepository.findByIds).mockResolvedValue([
      {
        _id: productId,
        name: "Test Product",
        variants: [{ _id: variantId, sku: "SKU-1" }],
      } as never,
    ]);
    vi.mocked(warehousesRepository.findById).mockResolvedValue({
      _id: warehouseA,
      name: "Mumbai",
      code: "MUM",
      active: true,
      createdAt: new Date(),
    });

    const result = await getInventoryList({}, { page: 1, limit: 20 });

    expect(result.items).toEqual([
      {
        _id: inventoryId,
        productId,
        productName: "Test Product",
        variantId,
        variantSku: "SKU-1",
        warehouseId: warehouseA,
        warehouseName: "Mumbai",
        stock: 4,
      },
    ]);
  });
});
