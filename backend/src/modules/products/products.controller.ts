import type { Request, Response } from "express";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseSlugParam } from "@/utils/routeParams";
import {
  createProduct,
  updateProduct,
  getProductById,
  listProductsForAdmin,
  deleteProduct,
  updateStock,
  updateProductStatus,
  addVariant,
  updateVariant,
  listPublicProducts,
  listPublicProductsByCategorySlug,
  getPublicProductBySlug,
} from "./products.service";
import { PRODUCT_STATUSES } from "./products.model";
import type { ProductSortField } from "./products.repository";

const objectIdString = z.string().refine(isValidObjectId, { message: "Must be a valid id." });

const productImageSchema = z.object({
  objectKey: z.string().min(1),
  alt: z.string().min(1).optional(),
  isPrimary: z.boolean().optional(),
});

const specificationValueSchema = z.object({
  name: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const specificationGroupSchema = z.object({
  groupName: z.string().min(1),
  values: z.array(specificationValueSchema),
});

// Image count (1-8) and sellingPrice are deliberately not bounded/accepted
// here: image count is enforced by uploads.service.ts's validateImageCount
// so there's one authoritative source for IMAGE_COUNT_OUT_OF_BOUNDS, and
// sellingPrice simply isn't a field on this schema — Zod's default "strip
// unknown keys" behavior is what makes a client-submitted sellingPrice have
// no effect rather than being rejected (FR-CAT-087).
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sku: z.string().min(1),
  brand: objectIdString,
  category: objectIdString,
  images: z.array(productImageSchema),
  specifications: z.array(specificationGroupSchema).optional().default([]),
  mrp: z.number().int().positive(),
  discount: z.number().int().min(0).max(99).optional().default(0),
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional().default(0),
  isFeatured: z.boolean().optional().default(false),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

// sku is absent — see products.service.ts's UpdateProductInput comment.
const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  brand: objectIdString.optional(),
  category: objectIdString.optional(),
  images: z.array(productImageSchema).optional(),
  specifications: z.array(specificationGroupSchema).optional(),
  mrp: z.number().int().positive().optional(),
  discount: z.number().int().min(0).max(99).optional(),
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

const updateStockSchema = z.object({ stock: z.number().int().min(0) });

const updateStatusSchema = z.object({ status: z.enum(PRODUCT_STATUSES) });

const productVariantAttributeSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

// Same mrp/discount/stock rules as products (FR-CAT-042); images has no
// count bound here — that's enforced by resolveVariantImages' bespoke
// { min: 1, max: 2 } call, only once at least one image is submitted, same
// "one authoritative source" reasoning as the product schema above.
const addVariantSchema = z.object({
  sku: z.string().min(1),
  attributes: z.array(productVariantAttributeSchema).min(1),
  images: z.array(productImageSchema).optional().default([]),
  mrp: z.number().int().positive(),
  discount: z.number().int().min(0).max(99).optional().default(0),
  stock: z.number().int().min(0),
  weight: z.number().positive().optional(),
});

const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  attributes: z.array(productVariantAttributeSchema).min(1).optional(),
  images: z.array(productImageSchema).optional(),
  mrp: z.number().int().positive().optional(),
  discount: z.number().int().min(0).max(99).optional(),
  stock: z.number().int().min(0).optional(),
  weight: z.number().positive().optional(),
  active: z.boolean().optional(),
});

const SORT_VALUES = [
  "createdAt",
  "-createdAt",
  "name",
  "-name",
  "mrp",
  "-mrp",
  "stock",
  "-stock",
] as const;

// search (FR-CAT-050) and status (FR-CAT-053, narrows the all-statuses admin
// grid further) are the two additions #34 makes to this schema.
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(SORT_VALUES).optional().default("-createdAt"),
  // Presence-based flag (FR-CAT-011) rather than a boolean coercion — a query
  // string has no boolean type, and "?lowStock=true" reads more explicitly
  // than accepting any truthy-looking value.
  lowStock: z.enum(["true"]).optional(),
  search: z.string().min(1).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

// Pure mapping, no I/O — SORT_VALUES already constrains the input via Zod,
// so this never sees an unrecognized field.
function parseSort(raw: (typeof SORT_VALUES)[number]): { field: ProductSortField; order: 1 | -1 } {
  const order: 1 | -1 = raw.startsWith("-") ? -1 : 1;
  const field = (raw.startsWith("-") ? raw.slice(1) : raw) as ProductSortField;
  return { field, order };
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  const input = createProductSchema.parse(req.body);
  const product = await createProduct({
    name: input.name,
    description: input.description,
    sku: input.sku,
    brand: new Types.ObjectId(input.brand),
    category: new Types.ObjectId(input.category),
    images: input.images,
    specifications: input.specifications,
    mrp: input.mrp,
    discount: input.discount,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    isFeatured: input.isFeatured,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  });
  res.status(201).json(successResponse(product));
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(id, {
    name: input.name,
    description: input.description,
    brand: input.brand !== undefined ? new Types.ObjectId(input.brand) : undefined,
    category: input.category !== undefined ? new Types.ObjectId(input.category) : undefined,
    images: input.images,
    specifications: input.specifications,
    mrp: input.mrp,
    discount: input.discount,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    isFeatured: input.isFeatured,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
  });
  res.status(200).json(successResponse(product));
}

export async function getProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const product = await getProductById(id);
  res.status(200).json(successResponse(product));
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  const sort = parseSort(query.sort);
  const { items, pagination } = await listProductsForAdmin({
    page: query.page,
    limit: query.limit,
    sort,
    lowStock: query.lowStock === "true",
    search: query.search,
    status: query.status,
  });
  res.status(200).json(successResponse(items, pagination));
}

export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  await deleteProduct(id);
  res.status(200).json(successResponse(null));
}

export async function updateStockHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateStockSchema.parse(req.body);
  const product = await updateStock(id, input.stock);
  res.status(200).json(successResponse(product));
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateStatusSchema.parse(req.body);
  const product = await updateProductStatus(id, input.status);
  res.status(200).json(successResponse(product));
}

// Both variant handlers return the full updated product, same as
// create/update above — variants are embedded, so there's no standalone
// variant resource to fetch on its own.
export async function addVariantHandler(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id);
  const input = addVariantSchema.parse(req.body);
  const product = await addVariant(productId, input);
  res.status(201).json(successResponse(product));
}

export async function updateVariantHandler(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id);
  const variantId = parseObjectId(req.params.variantId);
  const input = updateVariantSchema.parse(req.body);
  const product = await updateVariant(productId, variantId, input);
  res.status(200).json(successResponse(product));
}

// ---------------------------------------------------------------------------
// Buyer browsing (#35 / M2.11)
// ---------------------------------------------------------------------------

// FR-CAT-057: fixed default, server-enforced max, an oversized request is
// clamped rather than rejected — the opposite of the admin list's
// `.max(100)` (VALIDATION_ERROR on overage). No `.max()` in either schema
// below; clampLimit does the clamping after parsing instead.
const PUBLIC_PAGE_SIZE_DEFAULT = 24;
const PUBLIC_PAGE_SIZE_MAX = 48;

const publicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(PUBLIC_PAGE_SIZE_DEFAULT),
  q: z.string().min(1).optional(),
});

const publicCategoryProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).optional().default(PUBLIC_PAGE_SIZE_DEFAULT),
});

function clampLimit(limit: number): number {
  return Math.min(limit, PUBLIC_PAGE_SIZE_MAX);
}

export async function listPublicProductsHandler(req: Request, res: Response): Promise<void> {
  const query = publicListQuerySchema.parse(req.query);
  const { items, pagination } = await listPublicProducts({
    page: query.page,
    limit: clampLimit(query.limit),
    q: query.q,
  });
  res.status(200).json(successResponse(items, pagination));
}

export async function getPublicProductHandler(req: Request, res: Response): Promise<void> {
  const slug = parseSlugParam(req.params.slug);
  const product = await getPublicProductBySlug(slug);
  res.status(200).json(successResponse(product));
}

// Mounted from categories.public.routes.ts at
// GET /api/categories/:slug/products (FR-CAT-055) — the handler lives here,
// alongside the products data it returns, rather than in
// categories.controller.ts; only the route *wiring* crosses modules.
export async function listProductsByCategorySlugHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const slug = parseSlugParam(req.params.slug);
  const query = publicCategoryProductsQuerySchema.parse(req.query);
  const { items, pagination } = await listPublicProductsByCategorySlug(slug, {
    page: query.page,
    limit: clampLimit(query.limit),
  });
  res.status(200).json(successResponse(items, pagination));
}
