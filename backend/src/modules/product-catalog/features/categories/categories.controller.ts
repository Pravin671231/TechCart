import type { Request, Response } from "express";
import { isValidObjectId, Types, type QueryFilter } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseQuery } from "@/utils/parseQuery";
import { requireActorId } from "@/utils/actor";
import {
  createCategory,
  updateCategory,
  getCategoryById,
  listCategoriesForAdmin,
  listCategoriesForPublic,
  deleteCategory,
  updateCategoryStatus,
} from "./categories.service";
import { CATEGORY_SORT_FIELDS, type CategorySortField } from "./categories.repository";
import type { CategoryDocument } from "./categories.model";

const categoryImageSchema = z.object({
  objectKey: z.string().min(1),
  alt: z.string().min(1).optional(),
});

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

const createCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  parentCategory: objectIdString.optional(),
  image: categoryImageSchema.optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  // Tri-state, unlike every other field: absent (untouched), null (clear —
  // promote to root), or a valid id string (set/change parent).
  parentCategory: objectIdString.nullable().optional(),
  image: categoryImageSchema.optional(),
  sortOrder: z.number().int().optional(),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

const updateStatusSchema = z.object({ status: z.boolean() });

// Issue #104: pagination + sort added for the first time — `orderBy`
// defaults to "none" (no `sortBy` default) to preserve today's "no
// guaranteed order" behavior when the caller sends nothing.
const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(CATEGORY_SORT_FIELDS).optional(),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("none"),
  search: z.string().min(1).optional(),
});

// q is required here, unlike the admin list's optional search — this route
// exists specifically to search (FR-CAT-066), not to list.
const searchCategoriesQuerySchema = z.object({ q: z.string().min(1) });

function toObjectIdOrNull(value: string | null | undefined): Types.ObjectId | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Types.ObjectId(value);
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  const category = await createCategory({
    name: input.name,
    description: input.description,
    parentCategory:
      input.parentCategory !== undefined ? new Types.ObjectId(input.parentCategory) : undefined,
    image: input.image,
    sortOrder: input.sortOrder,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  }, requireActorId(req));
  res.status(201).json(successResponse(category));
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateCategorySchema.parse(req.body);
  const category = await updateCategory(id, {
    name: input.name,
    description: input.description,
    parentCategory: toObjectIdOrNull(input.parentCategory),
    image: input.image,
    sortOrder: input.sortOrder,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  }, requireActorId(req));
  res.status(200).json(successResponse(category));
}

export async function getCategoryHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const category = await getCategoryById(id);
  res.status(200).json(successResponse(category));
}

export async function listCategoriesHandler(req: Request, res: Response): Promise<void> {
  const query = listCategoriesQuerySchema.parse(req.query);
  const { filter, sort, page, limit } = parseQuery<CategorySortField>(
    query.search ? { value: query.search, fields: ["name"] } : undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    CATEGORY_SORT_FIELDS,
  );
  const { items, pagination } = await listCategoriesForAdmin(
    filter as QueryFilter<CategoryDocument>,
    sort,
    { page, limit },
  );
  res.status(200).json(successResponse(items, pagination));
}

export async function deleteCategoryHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  await deleteCategory(id);
  res.status(200).json(successResponse(null));
}

export async function updateCategoryStatusHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateStatusSchema.parse(req.body);
  const category = await updateCategoryStatus(id, input.status, requireActorId(req));
  res.status(200).json(successResponse(category));
}

export async function listPublicCategoriesHandler(_req: Request, res: Response): Promise<void> {
  const categories = await listCategoriesForPublic();
  res.status(200).json(successResponse(categories));
}

export async function searchPublicCategoriesHandler(req: Request, res: Response): Promise<void> {
  const query = searchCategoriesQuerySchema.parse(req.query);
  const categories = await listCategoriesForPublic(query.q);
  res.status(200).json(successResponse(categories));
}
