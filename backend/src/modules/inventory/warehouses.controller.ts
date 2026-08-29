import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { createWarehouse, listWarehouses } from "./warehouses.service";

// FR-INV-001 — a small, fixed set of warehouses; no status/edit fields to
// accept on create beyond name/code (always created active).
const createWarehouseSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export async function createWarehouseHandler(req: Request, res: Response): Promise<void> {
  const input = createWarehouseSchema.parse(req.body);
  const warehouse = await createWarehouse(input);
  res.status(201).json(successResponse(warehouse));
}

export async function listWarehousesHandler(_req: Request, res: Response): Promise<void> {
  const warehouses = await listWarehouses();
  res.status(200).json(successResponse(warehouses));
}
