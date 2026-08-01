import { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { generateUniqueSlug } from "@/utils/slug";
import { truncate } from "@/utils/text";
import { computeSellingPrice } from "@/utils/pricing";
import { deriveAvailability, bestAvailability, type Availability } from "@/utils/availability";
import type { Pagination } from "@/utils/apiResponse";
import {
  consumeImageKeys,
  validateImageCount,
  normalizeImages,
  buildPublicUrl,
} from "@/modules/uploads/uploads.service";
import { getBrandById } from "@/modules/brands/brands.service";
import {
  getCategoryById,
  getActiveCategoryBySlug,
  listActiveSubcategoryIds,
} from "@/modules/categories/categories.service";
import {
  validateProductSpecifications,
  getCardFieldsByCategoryIds,
  getFilterableFieldsByCategory,
  type CardSpecificationField,
} from "@/modules/categorySpecifications/categorySpecifications.service";
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
  findPublishedBySlug,
  listPublicPaginated,
  searchPublicPaginated,
  type ProductRecord,
  type CreateProductDoc,
  type UpdateProductDoc,
  type ProductSortField,
  type PublicProductDoc,
  type PopulatedRef,
  type PublicProductFilter,
  type PublicSort,
  type VariantAttributeFilter,
  type SpecFilter,
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
  search?: string | undefined;
  status?: ProductStatus | undefined;
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

// FR-CAT-060: deliberately identical shape/code to notFound(id) above — a
// slug that resolves to a draft/archived product must 404 exactly like a
// slug that was never assigned, never leaking that the product exists at
// all under a status the buyer shouldn't see (findPublishedBySlug already
// bakes status:"published" into the query itself, not a check afterward).
function notFoundBySlug(slug: string): AppError {
  return new AppError(404, "PRODUCT_NOT_FOUND", `Product "${slug}" was not found.`);
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
  const { items, total } = await listPaginated(
    { lowStock: params.lowStock, search: params.search, status: params.status },
    params.sort,
    { page: params.page, limit: params.limit },
  );

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

// ---------------------------------------------------------------------------
// Buyer browsing (#35 / M2.11, FR-CAT-054–067, FR-CAT-095–096)
// ---------------------------------------------------------------------------

export type PublicImage = { url: string; alt?: string };
export type PublicRef = { _id: Types.ObjectId; name: string; slug: string };

// FR-CAT-092: unit is explicitly `null` (not omitted) when the field has
// none — the one place this module breaks from its usual "omit an absent
// optional field" convention, matching the SRS's own worked example
// (`"unit": null`) precisely rather than this codebase's default.
export type PublicCardSpecification = {
  name: string;
  value: string | number | boolean;
  unit: string | null;
};

// FR-CAT-091's card contract (image, name, sellingPrice, no specifications)
// plus brand, availability, and — as of #36 — `cardSpecifications`
// (FR-CAT-092's first-four-filterable-specs augmentation), following the
// SRS's own worked listing-item example. `cardSpecifications` is always
// present, even as `[]` for a home/all-products listing or a category with
// no filterable fields — per the SRS, the home and category views share
// this one response shape, and it's `buyer-app`'s job to ignore the field
// on the home grid rather than the API omitting it in that context.
export type PublicProductListItem = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  brand: PublicRef;
  primaryImage?: PublicImage;
  mrp: number;
  discount: number;
  sellingPrice: number;
  availability: Availability;
  isFeatured: boolean;
  cardSpecifications: PublicCardSpecification[];
};

export type PublicProductVariant = {
  _id: Types.ObjectId;
  sku: string;
  attributes: ProductVariantAttribute[];
  images: PublicImage[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  availability: Availability;
  weight?: number;
};

export type PublicProductDetail = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: PublicRef;
  category: PublicRef;
  images: PublicImage[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  availability: Availability;
  isFeatured: boolean;
  specifications: ProductSpecificationGroup[];
  hasVariants: boolean;
  defaultVariantId?: Types.ObjectId;
  variants: PublicProductVariant[];
  metaTitle: string;
  metaDescription: string;
};

// #36 (FR-CAT-068–076): every filter/sort dimension the buyer listing
// supports. `categorySlug` is only meaningful on the flat endpoint
// (FR-CAT-070's `?category=`) — the category-scoped route already has its
// category from the path, hence PublicCategoryProductListParams below
// omitting both `q` (Atlas Search stays flat-listing-only, #35's original
// scoping decision) and `categorySlug`.
export type PublicProductListParams = {
  page: number;
  limit: number;
  q?: string | undefined;
  categorySlug?: string | undefined;
  brandIds?: Types.ObjectId[] | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  inStockOnly?: boolean | undefined;
  onSaleOnly?: boolean | undefined;
  variantAttribute?: VariantAttributeFilter | undefined;
  specFilters?: SpecFilter[] | undefined;
  sort?: PublicSort | undefined;
};

export type PublicCategoryProductListParams = Omit<
  PublicProductListParams,
  "q" | "categorySlug"
>;

function toPublicRef(ref: PopulatedRef): PublicRef {
  return { _id: ref._id, name: ref.name, slug: ref.slug };
}

function toPublicImage(image: ProductImage): PublicImage {
  const publicImage: PublicImage = { url: image.url };
  if (image.alt !== undefined) publicImage.alt = image.alt;
  return publicImage;
}

// normalizeImages() (FR-CAT-084) already guarantees exactly one isPrimary on
// every stored product, so .find() only ever misses on a product with zero
// images — which create/update's own 1-8 bound (FR-CAT-083) never allows to
// exist. The ?? images[0] fallback is defensive, not a case this codebase
// can actually produce.
function getPrimaryImage(images: ProductImage[]): ProductImage | undefined {
  return images.find((image) => image.isPrimary) ?? images[0];
}

// FR-CAT-012: buyer-facing pages fall back to name/a truncated description
// when metaTitle/metaDescription are unset — identical formula to
// categories.service.ts's listCategoriesForPublic, but this is products'
// first buyer-facing read path, so it's applied here for the first time
// rather than at create/update time. A product's description is always
// required (unlike categories', which is optional), so there's no further
// name fallback needed on the description side.
function resolveMeta(product: PublicProductDoc): { metaTitle: string; metaDescription: string } {
  return {
    metaTitle: product.metaTitle ?? product.name,
    metaDescription: product.metaDescription ?? truncate(product.description),
  };
}

// FR-CAT-064: the lowest-sellingPrice *active* variant. Inactive variants
// are never selectable/purchasable, so they're excluded here and from the
// buyer-facing variants[] array entirely — a deliberate interpretive call,
// since FR-CAT-040 never states whether an inactive variant is buyer-visible
// at all, and there's no reason to surface one the buyer can't select.
function selectDefaultVariant(variants: ProductVariant[]): ProductVariant | undefined {
  const active = variants.filter((variant) => variant.active);
  if (active.length === 0) return undefined;
  return active.reduce((lowest, variant) =>
    variant.sellingPrice < lowest.sellingPrice ? variant : lowest,
  );
}

function toPublicVariant(variant: ProductVariant, product: PublicProductDoc): PublicProductVariant {
  // FR-CAT-064's last sentence: a variant with no images of its own falls
  // back to the parent's images — resolved here so buyer-app consumers never
  // have to duplicate this fallback themselves.
  const images = variant.images.length > 0 ? variant.images : product.images;

  const publicVariant: PublicProductVariant = {
    _id: variant._id,
    sku: variant.sku,
    attributes: variant.attributes,
    images: images.map(toPublicImage),
    mrp: variant.mrp,
    discount: variant.discount,
    sellingPrice: variant.sellingPrice,
    // Variants carry no lowStockThreshold of their own — every per-unit
    // availability calculation in this module reuses the *parent product's*
    // single threshold, since the schema has nowhere else to store one.
    availability: deriveAvailability(variant.stock, product.lowStockThreshold),
  };
  if (variant.weight !== undefined) publicVariant.weight = variant.weight;
  return publicVariant;
}

// FR-CAT-096: "product-level availability, when variants exist, is the best
// state across active variants" — this is the *listing/card* reading of
// that rule (one availability badge per product). The *detail page's*
// initially-displayed availability is a different, narrower thing: per
// FR-CAT-064, it's whichever single unit is currently selected (the default
// variant, or the product's own stock when there's no active variant) — see
// toPublicDetail below, which deliberately does NOT use this function.
function listAvailability(product: PublicProductDoc): Availability {
  if (product.variants.length === 0) {
    return deriveAvailability(product.stock, product.lowStockThreshold);
  }
  const activeStates = product.variants
    .filter((variant) => variant.active)
    .map((variant) => deriveAvailability(variant.stock, product.lowStockThreshold));
  return bestAvailability(activeStates);
}

// cardSpecifications starts as [] here — attachCardSpecifications below
// fills in the real, category-schema-derived value afterward. Splitting it
// out this way keeps this function synchronous and per-product; the actual
// lookup is a batched, per-page query keyed by category, not something a
// single product's own mapper can do on its own.
function toPublicListItem(product: PublicProductDoc): PublicProductListItem {
  const primaryImage = getPrimaryImage(product.images);

  const item: PublicProductListItem = {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    brand: toPublicRef(product.brand),
    mrp: product.mrp,
    discount: product.discount,
    sellingPrice: product.sellingPrice,
    availability: listAvailability(product),
    isFeatured: product.isFeatured,
    cardSpecifications: [],
  };
  if (primaryImage) item.primaryImage = toPublicImage(primaryImage);
  return item;
}

// FR-CAT-092: a product's own value for each of its category's first-four
// filterable fields, in that same order — a field is skipped entirely
// (never padded with a null/placeholder entry) when the product has no
// stored value for it, matching "a product carrying fewer than four
// filterable specifications renders only those it has." Matched by name
// alone across all of the product's specification groups, the same
// simplification categorySpecifications.service.ts's card-field lookup
// already documents.
function findSpecificationValue(
  groups: ProductSpecificationGroup[],
  name: string,
): string | number | boolean | undefined {
  for (const group of groups) {
    const found = group.values.find((value) => value.name === name);
    if (found) return found.value;
  }
  return undefined;
}

function buildCardSpecifications(
  fields: CardSpecificationField[],
  specifications: ProductSpecificationGroup[],
): PublicCardSpecification[] {
  const result: PublicCardSpecification[] = [];
  for (const field of fields) {
    const value = findSpecificationValue(specifications, field.name);
    if (value === undefined) continue;
    result.push({ name: field.name, value, unit: field.unit ?? null });
  }
  return result;
}

// One batched lookup per result page (not per product) — mirrors
// countByCategoryIds'/countByBrandIds' existing "bulk map, default to empty
// for a missing key" shape from the admin modules. `docs` and `items` are
// guaranteed to be the same length in the same order (items is always
// `docs.map(toPublicListItem)`), so a plain index pairs each list item back
// with the raw doc its category id came from.
async function attachCardSpecifications(
  items: PublicProductListItem[],
  docs: PublicProductDoc[],
): Promise<PublicProductListItem[]> {
  const categoryIds = [...new Set(docs.map((doc) => doc.category._id.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  if (categoryIds.length === 0) return items;

  const cardFieldsByCategory = await getCardFieldsByCategoryIds(categoryIds);

  return items.map((item, index) => {
    const doc = docs[index]!;
    const fields = cardFieldsByCategory.get(doc.category._id.toString()) ?? [];
    return { ...item, cardSpecifications: buildCardSpecifications(fields, doc.specifications) };
  });
}

function toPublicDetail(product: PublicProductDoc): PublicProductDetail {
  const defaultVariant = selectDefaultVariant(product.variants);
  const activeVariants = product.variants.filter((variant) => variant.active);
  const { metaTitle, metaDescription } = resolveMeta(product);

  const detail: PublicProductDetail = {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    brand: toPublicRef(product.brand),
    category: toPublicRef(product.category),
    images: product.images.map(toPublicImage),
    // FR-CAT-064: the detail page's initially-displayed price/availability
    // come from the default variant, not the parent product's own stored
    // fields, whenever a purchasable (active) variant exists.
    mrp: defaultVariant ? defaultVariant.mrp : product.mrp,
    discount: defaultVariant ? defaultVariant.discount : product.discount,
    sellingPrice: defaultVariant ? defaultVariant.sellingPrice : product.sellingPrice,
    availability: defaultVariant
      ? deriveAvailability(defaultVariant.stock, product.lowStockThreshold)
      : deriveAvailability(product.stock, product.lowStockThreshold),
    isFeatured: product.isFeatured,
    // FR-CAT-063: every specification pair, grouped, regardless of
    // filterable — unlike list items, the detail page draws no distinction.
    specifications: product.specifications,
    hasVariants: activeVariants.length > 0,
    variants: activeVariants.map((variant) => toPublicVariant(variant, product)),
    metaTitle,
    metaDescription,
  };
  if (defaultVariant) detail.defaultVariantId = defaultVariant._id;
  return detail;
}

function buildPagination(page: number, limit: number, total: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNextPage: page < totalPages };
}

function invalidSpecFilter(name: string): AppError {
  return new AppError(
    400,
    "INVALID_SPECIFICATION_FILTER",
    `"${name}" is not a filterable specification field for this category.`,
  );
}

// FR-CAT-072/035: only meaningful when the listing resolves to a single
// category (the nested route, or ?category= on the flat one) — a category's
// `filterable` flag is schema-scoped, and an unscoped, catalog-wide listing
// has no single schema to validate against. In that unscoped case, submitted
// filters are matched literally rather than rejected — a deliberate
// simplification, not a security gap: the filter can only ever narrow
// results, never expose anything a plain query couldn't already reach.
async function resolveSpecFilters(
  categoryId: Types.ObjectId | undefined,
  raw: SpecFilter[] | undefined,
): Promise<SpecFilter[] | undefined> {
  if (!raw || raw.length === 0) return undefined;
  if (!categoryId) return raw;

  const filterable = await getFilterableFieldsByCategory(categoryId);
  for (const spec of raw) {
    const field = filterable.get(spec.name);
    if (!field) throw invalidSpecFilter(spec.name);
    // FR-CAT-072: number fields filter by range, enum/boolean by value —
    // reject a filter using the wrong shape for the field's actual type
    // rather than silently matching nothing.
    const expectedKind = field.type === "number" ? "range" : "value";
    if (spec.kind !== expectedKind) throw invalidSpecFilter(spec.name);
  }
  return raw;
}

// Shared by both public list functions below — the only difference between
// the flat listing and the category-scoped one is whether `categorySlug`
// arrives via a query param or is already fixed by the route, so both just
// funnel into this one implementation.
async function listPublicProductsCore(
  params: PublicProductListParams,
): Promise<{ items: PublicProductListItem[]; pagination: Pagination }> {
  const filter: PublicProductFilter = {};
  let categoryId: Types.ObjectId | undefined;

  if (params.categorySlug !== undefined) {
    const category = await getActiveCategoryBySlug(params.categorySlug);
    const subcategoryIds = await listActiveSubcategoryIds(category._id);
    filter.categoryIds = [category._id, ...subcategoryIds];
    categoryId = category._id;
  }
  if (params.brandIds) filter.brandIds = params.brandIds;
  if (params.minPrice !== undefined) filter.minPrice = params.minPrice;
  if (params.maxPrice !== undefined) filter.maxPrice = params.maxPrice;
  if (params.inStockOnly) filter.inStockOnly = true;
  if (params.onSaleOnly) filter.onSaleOnly = true;
  if (params.variantAttribute) filter.variantAttribute = params.variantAttribute;

  const specFilters = await resolveSpecFilters(categoryId, params.specFilters);
  if (specFilters) filter.specFilters = specFilters;

  // FR-CAT-075: an explicit sort always wins; absent one, a keyword search
  // defaults to relevance (score order) and a plain listing defaults to
  // newest-first — the same defaults #35 already established, just now
  // named explicitly rather than implicit in which function got called.
  const sort: PublicSort = params.sort ?? (params.q ? "relevance" : "newest");
  const page = { page: params.page, limit: params.limit };

  // FR-CAT-071/072: a variant-attribute or specification filter forces the
  // Atlas Search path even with no keyword query at all, since
  // embeddedDocument filtering has no plain-query equivalent here. FR-CAT-058:
  // an empty result is a normal empty page either way, never an error.
  const needsAtlasSearch = Boolean(
    params.q || filter.variantAttribute || (filter.specFilters?.length ?? 0) > 0,
  );
  const { items, total } = needsAtlasSearch
    ? await searchPublicPaginated(params.q, filter, sort, page)
    : await listPublicPaginated(filter, sort, page);

  const listItems = await attachCardSpecifications(items.map(toPublicListItem), items);

  return { items: listItems, pagination: buildPagination(params.page, params.limit, total) };
}

// FR-CAT-054/065/068–076: the flat, published-only listing — every filter
// and sort option composes here, plus ?q= Atlas Search keyword search and
// ?category= (FR-CAT-070's category filter on the *flat* endpoint,
// distinct from the dedicated nested route below, which pre-fixes the
// category via the URL instead of a query param).
export async function listPublicProducts(
  params: PublicProductListParams,
): Promise<{ items: PublicProductListItem[]; pagination: Pagination }> {
  return listPublicProductsCore(params);
}

// FR-CAT-055: resolves the category slug to itself plus its direct active
// subcategories (at most two levels deep, so "direct children" already
// covers the whole subtree) before delegating to the same core listing
// logic the flat endpoint uses — every filter/sort option composes here
// too, minus keyword search (Atlas Search stays flat-listing-only).
export async function listPublicProductsByCategorySlug(
  categorySlug: string,
  params: PublicCategoryProductListParams,
): Promise<{ items: PublicProductListItem[]; pagination: Pagination }> {
  return listPublicProductsCore({ ...params, categorySlug });
}

export async function getPublicProductBySlug(slug: string): Promise<PublicProductDetail> {
  const product = await findPublishedBySlug(slug);
  if (!product) throw notFoundBySlug(slug);
  return toPublicDetail(product);
}
