import { Types } from "mongoose";
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
import type {
  ProductImage,
  ProductSpecificationGroup,
  ProductStatus,
  ProductVariant,
  ProductVariantAttribute,
} from "./products.model";
import {
  create,
  findById,
  slugExists,
  skuInUse,
  updateById,
  replaceVariants,
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

// sku IS editable here, unlike the parent product's own — FR-CAT-004
// explicitly enumerates products' editable fields and omits sku, but
// FR-CAT-040's "admin can update a variant" names no such exclusion list,
// so a variant's sku is treated as editable, re-validated identically to
// create when it changes.
export type AddVariantInput = {
  sku: string;
  attributes: ProductVariantAttribute[];
  images: ProductImageInput[];
  mrp: number;
  discount: number;
  stock: number;
  weight?: number | undefined;
};

export type UpdateVariantInput = {
  sku?: string | undefined;
  attributes?: ProductVariantAttribute[] | undefined;
  images?: ProductImageInput[] | undefined;
  mrp?: number | undefined;
  discount?: number | undefined;
  stock?: number | undefined;
  weight?: number | undefined;
  active?: boolean | undefined;
};

function notFound(id: Types.ObjectId): AppError {
  return new AppError(404, "PRODUCT_NOT_FOUND", `Product ${id.toString()} was not found.`);
}

function variantNotFound(variantId: Types.ObjectId): AppError {
  return new AppError(404, "VARIANT_NOT_FOUND", `Variant ${variantId.toString()} was not found.`);
}

function duplicateSku(sku: string): AppError {
  return new AppError(
    400,
    "DUPLICATE_SKU",
    `SKU "${sku}" is already in use by another product or variant.`,
  );
}

function duplicateVariantAttributes(): AppError {
  return new AppError(
    400,
    "DUPLICATE_VARIANT_ATTRIBUTES",
    "A variant with this exact attribute combination already exists on this product.",
  );
}

// Canonical form for comparing attribute sets regardless of submission order
// (FR-CAT-041) — two variants sharing {Color:Red, Size:L} collide whether one
// submits them as [Color,Size] and the other as [Size,Color].
function attributeSetKey(attributes: ProductVariantAttribute[]): string {
  return attributes
    .map((attribute) => `${attribute.name}=${attribute.value}`)
    .sort()
    .join("|");
}

// Shared by create and update. validateImageCount/consumeImageKeys/
// normalizeImages/buildPublicUrl are uploads.service.ts exports built during
// #26 specifically for this call — see backend/CLAUDE.md's R2 uploads
// section. { min: 1, max: 8 } matches FR-CAT-083's product bound; variants'
// bespoke { min: 0/1, max: 2 } bound is resolveVariantImages below.
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

// FR-CAT-045 — the general three-state setter. Unlike brands'/categories'
// boolean toggle, a product's status is a tri-state enum, so this is a plain
// pass-through rather than a flip; validity of the value itself is Zod's job
// in products.controller.ts.
export async function updateProductStatus(
  id: Types.ObjectId,
  status: ProductStatus,
): Promise<ProductRecord> {
  const updated = await updateById(id, { status });
  if (!updated) throw notFound(id);
  return updated;
}

// Soft delete only (FR-CAT-007) — Orders (v0.5) will hold product references
// that must not dangle. Unlike brands'/categories' guarded deletes, there's
// no in-use count to check (nothing downstream references products yet), so
// this is just updateProductStatus(id, "archived") under a delete-shaped
// name; a nonexistent id 404s rather than silently no-opping, since there's
// no "naturally zero" guard count to fall back on.
export async function deleteProduct(id: Types.ObjectId): Promise<void> {
  await updateProductStatus(id, "archived");
}

export async function updateStock(id: Types.ObjectId, stock: number): Promise<ProductRecord> {
  const updated = await updateById(id, { stock });
  if (!updated) throw notFound(id);
  return updated;
}

// Same shape as resolveImages above, different bound: FR-CAT-064's "0 or 1-2"
// rather than FR-CAT-083's "1-8" — an empty array is valid (falls back to the
// parent's images at read time, #35's concern), so the count guard only
// engages once at least one image is submitted.
async function resolveVariantImages(images: ProductImageInput[]): Promise<ProductImage[]> {
  if (images.length === 0) return [];

  validateImageCount(images, { min: 1, max: 2 });
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

// The three-part SKU cross-check FR-CAT-003's shared namespace needs: against
// the parent product's own sku, against every *other* variant already on
// this product, and — via skuInUse(sku, productId) — against every other
// product's own sku and variants anywhere else. skuInUse excludes the whole
// current product doc by id, so it deliberately doesn't cover the first two
// cases; those are checked locally against the already-fetched `product`.
async function assertVariantSkuAvailable(
  product: ProductRecord,
  sku: string,
  excludeVariantId?: Types.ObjectId,
): Promise<void> {
  if (sku === product.sku) throw duplicateSku(sku);
  const collidesWithSibling = product.variants.some(
    (variant) => !(excludeVariantId && variant._id.equals(excludeVariantId)) && variant.sku === sku,
  );
  if (collidesWithSibling) throw duplicateSku(sku);
  if (await skuInUse(sku, product._id)) throw duplicateSku(sku);
}

export async function addVariant(
  productId: Types.ObjectId,
  input: AddVariantInput,
): Promise<ProductRecord> {
  const product = await findById(productId);
  if (!product) throw notFound(productId);

  await assertVariantSkuAvailable(product, input.sku);

  const key = attributeSetKey(input.attributes);
  if (product.variants.some((variant) => attributeSetKey(variant.attributes) === key)) {
    throw duplicateVariantAttributes();
  }

  const images = await resolveVariantImages(input.images);
  const sellingPrice = computeSellingPrice(input.mrp, input.discount);

  const variant: ProductVariant = {
    _id: new Types.ObjectId(),
    sku: input.sku,
    attributes: input.attributes,
    images,
    mrp: input.mrp,
    discount: input.discount,
    sellingPrice,
    stock: input.stock,
    active: true,
  };
  if (input.weight !== undefined) variant.weight = input.weight;

  const updated = await replaceVariants(productId, [...product.variants, variant]);
  if (!updated) throw notFound(productId);
  return updated;
}

// Deactivation (`active: false`) is just another field on this same PATCH —
// FR-CAT-040 doesn't split it into a separate endpoint, and a variant is
// never hard-removed regardless of `active`'s value.
export async function updateVariant(
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  input: UpdateVariantInput,
): Promise<ProductRecord> {
  const product = await findById(productId);
  if (!product) throw notFound(productId);

  const index = product.variants.findIndex((variant) => variant._id.equals(variantId));
  if (index === -1) throw variantNotFound(variantId);
  const existingVariant = product.variants[index]!;

  if (input.sku !== undefined && input.sku !== existingVariant.sku) {
    await assertVariantSkuAvailable(product, input.sku, variantId);
  }

  if (input.attributes !== undefined) {
    const key = attributeSetKey(input.attributes);
    const collidesWithSibling = product.variants.some(
      (variant, i) => i !== index && attributeSetKey(variant.attributes) === key,
    );
    if (collidesWithSibling) throw duplicateVariantAttributes();
  }

  const updatedVariant: ProductVariant = { ...existingVariant };
  if (input.sku !== undefined) updatedVariant.sku = input.sku;
  if (input.attributes !== undefined) updatedVariant.attributes = input.attributes;
  if (input.images !== undefined) updatedVariant.images = await resolveVariantImages(input.images);
  if (input.mrp !== undefined || input.discount !== undefined) {
    const mrp = input.mrp ?? existingVariant.mrp;
    const discount = input.discount ?? existingVariant.discount;
    updatedVariant.mrp = mrp;
    updatedVariant.discount = discount;
    updatedVariant.sellingPrice = computeSellingPrice(mrp, discount);
  }
  if (input.stock !== undefined) updatedVariant.stock = input.stock;
  if (input.weight !== undefined) updatedVariant.weight = input.weight;
  if (input.active !== undefined) updatedVariant.active = input.active;

  const updatedVariants = [...product.variants];
  updatedVariants[index] = updatedVariant;

  const updated = await replaceVariants(productId, updatedVariants);
  if (!updated) throw notFound(productId);
  return updated;
}
