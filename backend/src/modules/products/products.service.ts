import type { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { generateUniqueSlug } from "@/utils/slug";
import { computeSellingPrice } from "@/utils/pricing";
import type { Pagination } from "@/utils/apiResponse";
import {
  consumeImageKeys,
  validateImageCount,
  normalizeImages,
  buildPublicUrl,
} from "@/modules/uploads/uploads.service";
import { getBrandById } from "@/modules/brands/brands.service";
import { getCategoryById } from "@/modules/categories/categories.service";
import { validateProductSpecifications } from "@/modules/categorySpecifications/categorySpecifications.service";
import type { ProductImage, ProductSpecificationGroup } from "./products.model";
import {
  create,
  findById,
  slugExists,
  skuInUse,
  updateById,
  listPaginated,
  type ProductRecord,
  type CreateProductDoc,
  type UpdateProductDoc,
  type ProductSortField,
} from "./products.repository";

// Optional fields spell out `| undefined` explicitly (not just `?:`), same
// reasoning as every prior catalog module's *Input types: these accept a
// parsed Zod object, and under exactOptionalPropertyTypes: true, Zod's
// `.optional()` output type is `T | undefined`, wider than a bare `key?: T`.
export type ProductImageInput = {
  objectKey: string;
  alt?: string | undefined;
  isPrimary?: boolean | undefined;
};

export type CreateProductInput = {
  name: string;
  description: string;
  sku: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  images: ProductImageInput[];
  specifications: ProductSpecificationGroup[];
  mrp: number;
  discount: number;
  stock: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
};

// sku is deliberately absent — FR-CAT-004's editable-field list doesn't
// include it, so it's set once at create time and never touched again,
// exactly like brands'/categories' slug.
export type UpdateProductInput = {
  name?: string | undefined;
  description?: string | undefined;
  brand?: Types.ObjectId | undefined;
  category?: Types.ObjectId | undefined;
  images?: ProductImageInput[] | undefined;
  specifications?: ProductSpecificationGroup[] | undefined;
  mrp?: number | undefined;
  discount?: number | undefined;
  stock?: number | undefined;
  lowStockThreshold?: number | undefined;
  isFeatured?: boolean | undefined;
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
};

export type ProductListParams = {
  page: number;
  limit: number;
  sort: { field: ProductSortField; order: 1 | -1 };
  lowStock: boolean;
};

function notFound(id: Types.ObjectId): AppError {
  return new AppError(404, "PRODUCT_NOT_FOUND", `Product ${id.toString()} was not found.`);
}

function duplicateSku(sku: string): AppError {
  return new AppError(
    400,
    "DUPLICATE_SKU",
    `SKU "${sku}" is already in use by another product or variant.`,
  );
}

// Shared by create and update. validateImageCount/consumeImageKeys/
// normalizeImages/buildPublicUrl are uploads.service.ts exports built during
// #26 specifically for this call — see backend/CLAUDE.md's R2 uploads
// section. { min: 1, max: 8 } matches FR-CAT-083's product bound (variants'
// { min: 0, max: 2 } is #32's concern).
async function resolveImages(images: ProductImageInput[]): Promise<ProductImage[]> {
  validateImageCount(images, { min: 1, max: 8 });
  await consumeImageKeys(images.map((image) => image.objectKey));

  const withUrls: ProductImage[] = images.map((image) => {
    const resolved: ProductImage = {
      url: buildPublicUrl(image.objectKey),
      isPrimary: image.isPrimary ?? false,
    };
    if (image.alt !== undefined) resolved.alt = image.alt;
    return resolved;
  });

  return normalizeImages(withUrls);
}

export async function createProduct(input: CreateProductInput): Promise<ProductRecord> {
  await getBrandById(input.brand);
  await getCategoryById(input.category);

  if (await skuInUse(input.sku)) throw duplicateSku(input.sku);
  await validateProductSpecifications(input.category, input.specifications);

  const slug = await generateUniqueSlug(input.name, slugExists);
  const images = await resolveImages(input.images);
  const sellingPrice = computeSellingPrice(input.mrp, input.discount);

  const doc: CreateProductDoc = {
    name: input.name,
    slug,
    sku: input.sku,
    description: input.description,
    brand: input.brand,
    category: input.category,
    images,
    specifications: input.specifications,
    mrp: input.mrp,
    discount: input.discount,
    sellingPrice,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    isFeatured: input.isFeatured,
  };
  if (input.metaTitle !== undefined) doc.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) doc.metaDescription = input.metaDescription;

  return create(doc);
}

// Slug and sku are never touched here — see UpdateProductInput's comment.
// category re-validates its own existence, and — per FR-CAT-034 — triggers a
// re-validation of specifications against the *new* schema even when the
// request itself doesn't also submit new specifications (the existing
// stored ones must still satisfy whatever category the product ends up in).
export async function updateProduct(
  id: Types.ObjectId,
  input: UpdateProductInput,
): Promise<ProductRecord> {
  const existing = await findById(id);
  if (!existing) throw notFound(id);

  if (input.brand !== undefined) await getBrandById(input.brand);
  if (input.category !== undefined) await getCategoryById(input.category);

  if (input.category !== undefined || input.specifications !== undefined) {
    const effectiveCategory = input.category ?? existing.category;
    const effectiveSpecifications = input.specifications ?? existing.specifications;
    await validateProductSpecifications(effectiveCategory, effectiveSpecifications);
  }

  const patch: UpdateProductDoc = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.category !== undefined) patch.category = input.category;
  if (input.images !== undefined) patch.images = await resolveImages(input.images);
  if (input.specifications !== undefined) patch.specifications = input.specifications;
  if (input.mrp !== undefined || input.discount !== undefined) {
    const mrp = input.mrp ?? existing.mrp;
    const discount = input.discount ?? existing.discount;
    patch.mrp = mrp;
    patch.discount = discount;
    patch.sellingPrice = computeSellingPrice(mrp, discount);
  }
  if (input.stock !== undefined) patch.stock = input.stock;
  if (input.lowStockThreshold !== undefined) patch.lowStockThreshold = input.lowStockThreshold;
  if (input.isFeatured !== undefined) patch.isFeatured = input.isFeatured;
  if (input.metaTitle !== undefined) patch.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) patch.metaDescription = input.metaDescription;

  const updated = await updateById(id, patch);
  if (!updated) throw notFound(id);
  return updated;
}

export async function getProductById(id: Types.ObjectId): Promise<ProductRecord> {
  const product = await findById(id);
  if (!product) throw notFound(id);
  return product;
}

export async function listProductsForAdmin(
  params: ProductListParams,
): Promise<{ items: ProductRecord[]; pagination: Pagination }> {
  const { items, total } = await listPaginated({ lowStock: params.lowStock }, params.sort, {
    page: params.page,
    limit: params.limit,
  });

  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
    },
  };
}

// Soft delete only (FR-CAT-007) — Orders (v0.5) will hold product references
// that must not dangle. Unlike brands'/categories' guarded deletes, there's
// no in-use count to check (nothing downstream references products yet), so
// this is a plain status flip; a nonexistent id 404s rather than silently
// no-opping, since there's no "naturally zero" guard count to fall back on.
export async function deleteProduct(id: Types.ObjectId): Promise<void> {
  const updated = await updateById(id, { status: "archived" });
  if (!updated) throw notFound(id);
}

export async function updateStock(id: Types.ObjectId, stock: number): Promise<ProductRecord> {
  const updated = await updateById(id, { stock });
  if (!updated) throw notFound(id);
  return updated;
}
