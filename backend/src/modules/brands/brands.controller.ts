import type { Request, Response } from "express";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import {
  createBrand,
  updateBrand,
  getBrandById,
  listBrandsForAdmin,
  listBrandsForPublic,
  deleteBrand,
} from "./brands.service";

const logoSchema = z.object({
  objectKey: z.string().min(1),
  alt: z.string().min(1).optional(),
});

const createBrandSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  logo: logoSchema.optional(),
});

const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  logo: logoSchema.optional(),
});

// Neither existing module (health, uploads) has an :id route, and
// errorHandler.ts has no CastError handling — an invalid ObjectId string
// would otherwise fall through to a generic 500. Validate the shape here so
// it becomes the standard 400 error contract instead.
function parseObjectId(id: string | string[] | undefined): Types.ObjectId {
  if (typeof id !== "string" || !isValidObjectId(id)) {
    throw new AppError(400, "INVALID_ID", `"${String(id)}" is not a valid id.`);
  }
  return new Types.ObjectId(id);
}

export async function createBrandHandler(req: Request, res: Response): Promise<void> {
  const input = createBrandSchema.parse(req.body);
  const brand = await createBrand(input);
  res.status(201).json(successResponse(brand));
}

export async function updateBrandHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateBrandSchema.parse(req.body);
  const brand = await updateBrand(id, input);
  res.status(200).json(successResponse(brand));
}

export async function getBrandHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const brand = await getBrandById(id);
  res.status(200).json(successResponse(brand));
}

export async function listBrandsHandler(_req: Request, res: Response): Promise<void> {
  const brands = await listBrandsForAdmin();
  res.status(200).json(successResponse(brands));
}

export async function deleteBrandHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  await deleteBrand(id);
  res.status(200).json(successResponse(null));
}

export async function listPublicBrandsHandler(_req: Request, res: Response): Promise<void> {
  const brands = await listBrandsForPublic();
  res.status(200).json(successResponse(brands));
}
