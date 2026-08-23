import type { Request, Response } from "express";
import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseSlugParam } from "@/utils/routeParams";
import { parseQuery } from "@/utils/parseQuery";
import { requireActorId } from "@/utils/actor";
import {
  createProduct,
  updateProduct,
  getProductById,
  listProductsForAdmin,
  deleteProduct,
  updateProductStatus,
  addVariant,
  updateVariant,
  listPublicProducts,
  listPublicProductsByCategorySlug,
  getPublicProductBySlug,
} from "./products.service";
import { PRODUCT_STATUSES } from "./products.model";
import { PRODUCT_SORT_FIELDS, type ProductSortField, type SpecFilter } from "./products.repository";

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

// Every sellable, priced, imaged field lives on the variant, not the product
// (Issue #102, SRS v0.2 amendment) — a product create/update is just its own
// metadata plus specifications/SEO/isFeatured.
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  brand: objectIdString,
  category: objectIdString,
  specifications: z.array(specificationGroupSchema).optional().default([]),
  isFeatured: z.boolean().optional().default(false),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  brand: objectIdString.optional(),
  category: objectIdString.optional(),
  specifications: z.array(specificationGroupSchema).optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().min(1).optional(),
  metaDescription: z.string().min(1).optional(),
});

const updateStatusSchema = z.object({ status: z.enum(PRODUCT_STATUSES) });

const productVariantAttributeSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

// Same mrp/discount rules as products' own pricing did (FR-CAT-042, §2.13);
// images has no count bound here — that's enforced by resolveVariantImages'
// { min: 1, max: 2 } call, one authoritative source for
// IMAGE_COUNT_OUT_OF_BOUNDS, same reasoning the product schema used to use.
const addVariantSchema = z.object({
  sku: z.string().min(1),
  attributes: z.array(productVariantAttributeSchema).min(1),
  images: z.array(productImageSchema),
  mrp: z.number().int().positive(),
  discount: z.number().int().min(0).max(99).optional().default(0),
  weight: z.number().positive().optional(),
});

const updateVariantSchema = z.object({
  sku: z.string().min(1).optional(),
  attributes: z.array(productVariantAttributeSchema).min(1).optional(),
  images: z.array(productImageSchema).optional(),
  mrp: z.number().int().positive().optional(),
  discount: z.number().int().min(0).max(99).optional(),
  weight: z.number().positive().optional(),
  active: z.boolean().optional(),
});

// search (FR-CAT-050) and status (FR-CAT-053, narrows the all-statuses admin
// grid further) are two of #34's additions to this schema. lowStock
// (FR-CAT-011) was removed by #102 — there's no stock to filter on. Issue
// #104: sort splits from the old combined `?sort=-field` enum into
// `sortBy`/`orderBy`; defaults ("createdAt"/"desc") reproduce the old
// `-createdAt` default exactly.
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).optional().default("createdAt"),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("desc"),
  search: z.string().min(1).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  const input = createProductSchema.parse(req.body);
  const product = await createProduct(
    {
      name: input.name,
      description: input.description,
      brand: new Types.ObjectId(input.brand),
      category: new Types.ObjectId(input.category),
      specifications: input.specifications,
      isFeatured: input.isFeatured,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    },
    requireActorId(req),
  );
  res.status(201).json(successResponse(product));
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(
    id,
    {
      name: input.name,
      description: input.description,
      brand: input.brand !== undefined ? new Types.ObjectId(input.brand) : undefined,
      category: input.category !== undefined ? new Types.ObjectId(input.category) : undefined,
      specifications: input.specifications,
      isFeatured: input.isFeatured,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    },
    requireActorId(req),
  );
  res.status(200).json(successResponse(product));
}

export async function getProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const product = await getProductById(id);
  res.status(200).json(successResponse(product));
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.parse(req.query);
  // search stays untouched, bespoke, inside listProductsForAdmin/listPaginated
  // (name + variants.sku, asymmetric regex shapes) — parseQuery is only
  // consulted here for sortBy/orderBy/field (Issue #104).
  const { sort } = parseQuery<ProductSortField>(
    undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    PRODUCT_SORT_FIELDS,
  );
  const { items, pagination } = await listProductsForAdmin({
    page: query.page,
    limit: query.limit,
    sort,
    search: query.search,
    status: query.status,
  });
  res.status(200).json(successResponse(items, pagination));
}

export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  await deleteProduct(id, requireActorId(req));
  res.status(200).json(successResponse(null));
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateStatusSchema.parse(req.body);
  const product = await updateProductStatus(id, input.status, requireActorId(req));
  res.status(200).json(successResponse(product));
}

// Both variant handlers return the full updated product, same as
// create/update above — variants are embedded, so there's no standalone
// variant resource to fetch on its own.
export async function addVariantHandler(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id);
  const input = addVariantSchema.parse(req.body);
  const product = await addVariant(productId, input, requireActorId(req));
  res.status(201).json(successResponse(product));
}

export async function updateVariantHandler(req: Request, res: Response): Promise<void> {
  const productId = parseObjectId(req.params.id);
  const variantId = parseObjectId(req.params.variantId);
  const input = updateVariantSchema.parse(req.body);
  const product = await updateVariant(productId, variantId, input, requireActorId(req));
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

// FR-CAT-069: accepts either a repeated query key (?brand=a&brand=b) or a
// single comma-joined value (?brand=a,b) — both are common conventions for
// a multi-select filter, and there's no reason to force the client into
// exactly one. Validated as a flat list of ids, not raw strings, so an
// invalid id anywhere in the list surfaces as the same VALIDATION_ERROR
// shape every other :id-style field in this codebase uses.
const brandFilterSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((raw) =>
    (Array.isArray(raw) ? raw : [raw])
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )
  .refine((ids) => ids.every((id) => isValidObjectId(id)), {
    message: "Must be a list of valid ids.",
  })
  .optional();

// FR-CAT-072: enum/boolean specs submit a plain string value
// (?spec[RAM]=8GB); number specs submit a range object via qs's bracket
// notation (?spec[ScreenSize][min]=6&spec[ScreenSize][max]=6.5). Which shape
// is legal for a given field name is a category-schema question this
// controller can't answer — products.service.ts's resolveSpecFilters
// rejects a shape/type mismatch once it knows the category.
const specFilterRangeSchema = z
  .object({ min: z.string().optional(), max: z.string().optional() })
  .refine((range) => range.min !== undefined || range.max !== undefined, {
    message: "At least one of min/max is required.",
  });
const specFilterQuerySchema = z
  .record(z.string(), z.union([z.string(), specFilterRangeSchema]))
  .optional();

const publicFilterFieldsSchema = z.object({
  brand: brandFilterSchema,
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  onSale: z.enum(["true"]).optional(),
  // FR-CAT-071: a single name/value pair (the SRS's own wording is
  // singular, "a variant attribute name and value") — both or neither, not
  // one alone, enforced by the .refine() below rather than making one
  // optional and silently ignoring a half-submitted filter.
  attributeName: z.string().min(1).optional(),
  attributeValue: z.string().min(1).optional(),
  spec: specFilterQuerySchema,
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional(),
});

const publicListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).optional().default(PUBLIC_PAGE_SIZE_DEFAULT),
    q: z.string().min(1).optional(),
    // FR-CAT-070: category filter on the *flat* listing, by slug — distinct
    // from the dedicated GET /api/categories/:slug/products route, which
    // pre-fixes the category via the URL instead.
    category: z.string().min(1).optional(),
  })
  .extend(publicFilterFieldsSchema.shape)
  .refine((query) => (query.attributeName === undefined) === (query.attributeValue === undefined), {
    message: "attributeName and attributeValue must be submitted together.",
    path: ["attributeValue"],
  });

const publicCategoryProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).optional().default(PUBLIC_PAGE_SIZE_DEFAULT),
  })
  .extend(publicFilterFieldsSchema.shape)
  .refine((query) => (query.attributeName === undefined) === (query.attributeValue === undefined), {
    message: "attributeName and attributeValue must be submitted together.",
    path: ["attributeValue"],
  });

function clampLimit(limit: number): number {
  return Math.min(limit, PUBLIC_PAGE_SIZE_MAX);
}

// "true"/"false" strings only — number-typed spec filters never reach this
// path (they're always range objects, parsed separately below), so there's
// no numeric coercion to attempt here.
function coerceSpecValue(raw: string): string | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function parseSpecFilters(
  raw: Record<string, string | { min?: string | undefined; max?: string | undefined }> | undefined,
): SpecFilter[] | undefined {
  if (!raw) return undefined;

  const filters: SpecFilter[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      filters.push({ name, kind: "value", value: coerceSpecValue(value) });
      continue;
    }
    const range: SpecFilter = { name, kind: "range" };
    if (value.min !== undefined) range.min = Number(value.min);
    if (value.max !== undefined) range.max = Number(value.max);
    filters.push(range);
  }
  return filters.length > 0 ? filters : undefined;
}

function parseBrandIds(ids: string[] | undefined): Types.ObjectId[] | undefined {
  return ids && ids.length > 0 ? ids.map((id) => new Types.ObjectId(id)) : undefined;
}

function parseVariantAttribute(
  name: string | undefined,
  value: string | undefined,
): { name: string; value: string } | undefined {
  return name !== undefined && value !== undefined ? { name, value } : undefined;
}

export async function listPublicProductsHandler(req: Request, res: Response): Promise<void> {
  const query = publicListQuerySchema.parse(req.query);
  const { items, pagination } = await listPublicProducts({
    page: query.page,
    limit: clampLimit(query.limit),
    q: query.q,
    categorySlug: query.category,
    brandIds: parseBrandIds(query.brand),
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    onSaleOnly: query.onSale === "true",
    variantAttribute: parseVariantAttribute(query.attributeName, query.attributeValue),
    specFilters: parseSpecFilters(query.spec),
    sort: query.sort,
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
    brandIds: parseBrandIds(query.brand),
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    onSaleOnly: query.onSale === "true",
    variantAttribute: parseVariantAttribute(query.attributeName, query.attributeValue),
    specFilters: parseSpecFilters(query.spec),
    sort: query.sort,
  });
  res.status(200).json(successResponse(items, pagination));
}
