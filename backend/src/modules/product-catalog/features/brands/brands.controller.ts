import type { Request, Response } from "express";
import { type QueryFilter } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseQuery } from "@/utils/parseQuery";
import {
  createBrand,
  updateBrand,
  getBrandById,
  listBrandsForAdmin,
  listBrandsForPublic,
  deleteBrand,
  updateBrandStatus,
} from "./brands.service";
import { BRAND_SORT_FIELDS, type BrandSortField } from "./brands.repository";
import type { BrandDocument } from "./brands.model";

const logoSchema = z.object({
  objectKey: z.string().min(1),
  alt: z.string().min(1).optional(),
});

const updateStatusSchema = z.object({ status: z.boolean() });

// Issue #104: pagination + sort added for the first time — `orderBy`
// defaults to "none" (no `sortBy` default) to preserve today's "no
// guaranteed order" behavior when the caller sends nothing.
const listBrandsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(BRAND_SORT_FIELDS).optional(),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("none"),
  search: z.string().min(1).optional(),
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
  const { filter, sort, page, limit } = parseQuery<BrandSortField>(
    query.search ? { value: query.search, fields: ["name"] } : undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    BRAND_SORT_FIELDS,
  );
  const { items, pagination } = await listBrandsForAdmin(
    filter as QueryFilter<BrandDocument>,
    sort,
    { page, limit },
  );
  res.status(200).json(successResponse(items, pagination));
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
