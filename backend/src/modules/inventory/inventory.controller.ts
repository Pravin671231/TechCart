import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse, buildPagination } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { getInventoryList, updateStock } from "./inventory.service";

const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  warehouseId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
});

const updateStockSchema = z.object({
  stock: z.number().int(),
});

export async function listInventoryHandler(req: Request, res: Response): Promise<void> {
  const query = listInventoryQuerySchema.parse(req.query);
  const filter = {
    ...(query.warehouseId ? { warehouseId: parseObjectId(query.warehouseId) } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
  const { items, total } = await getInventoryList(filter, { page: query.page, limit: query.limit });
  res.status(200).json(successResponse(items, buildPagination(query.page, query.limit, total)));
}

export async function updateInventoryStockHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.inventoryId);
  const input = updateStockSchema.parse(req.body);
  const record = await updateStock(id, input.stock);
  res.status(200).json(successResponse(record));
}
