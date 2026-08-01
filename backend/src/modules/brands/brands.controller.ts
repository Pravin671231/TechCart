import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import {
  createBrand,
  updateBrand,
  getBrandById,
  listBrandsForAdmin,
  listBrandsForPublic,
  deleteBrand,
  updateBrandStatus,
} from "./brands.service";

const logoSchema = z.object({
  objectKey: z.string().min(1),
  alt: z.string().min(1).optional(),
});

const updateStatusSchema = z.object({ status: z.boolean() });

const listBrandsQuerySchema = z.object({ search: z.string().min(1).optional() });

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

export async function listBrandsHandler(req: Request, res: Response): Promise<void> {
  const query = listBrandsQuerySchema.parse(req.query);
  const brands = await listBrandsForAdmin(query.search);
  res.status(200).json(successResponse(brands));
}

export async function deleteBrandHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  await deleteBrand(id);
  res.status(200).json(successResponse(null));
}

export async function updateBrandStatusHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateStatusSchema.parse(req.body);
  const brand = await updateBrandStatus(id, input.status);
  res.status(200).json(successResponse(brand));
}

export async function listPublicBrandsHandler(_req: Request, res: Response): Promise<void> {
  const brands = await listBrandsForPublic();
  res.status(200).json(successResponse(brands));
}
