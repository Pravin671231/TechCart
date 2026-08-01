import type { QueryFilter, Types } from "mongoose";
import { escapeRegExp } from "@/utils/text";
import {
  Product,
  type ProductDocument,
  type ProductImage,
  type ProductSpecificationGroup,
  type ProductStatus,
  type ProductVariant,
} from "./products.model";

export type ProductRecord = ProductDocument & { _id: Types.ObjectId };

export type CreateProductDoc = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  images: ProductImage[];
  specifications: ProductSpecificationGroup[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
};

export type UpdateProductDoc = Partial<CreateProductDoc> & { status?: ProductStatus };

export async function create(doc: CreateProductDoc): Promise<ProductRecord> {
  const product = await Product.create(doc);
  return product.toObject();
}

export async function findById(id: Types.ObjectId): Promise<ProductRecord | null> {
  return Product.findById(id).lean();
}

// Buyer-facing detail/list responses need the brand's/category's own name
// and slug, not just the raw ref id — the first use of Mongoose `.populate()`
// in this codebase (every admin read so far has been happy with the raw ref).
// Selecting just "name slug" keeps the join minimal; `_id` comes along by
// default.
export type PopulatedRef = { _id: Types.ObjectId; name: string; slug: string };
export type PublicProductDoc = Omit<ProductRecord, "brand" | "category"> & {
  brand: PopulatedRef;
  category: PopulatedRef;
};

// FR-CAT-056/060: status:"published" is baked into the query itself, not
// checked after the fact — a draft/archived product's slug returns exactly
// the same "not found" as a slug that was never assigned, never a 200 with
// a status the buyer shouldn't see.
export async function findPublishedBySlug(slug: string): Promise<PublicProductDoc | null> {
  return Product.findOne({ slug, status: "published" })
    .populate<{ brand: PopulatedRef }>("brand", "name slug")
    .populate<{ category: PopulatedRef }>("category", "name slug")
    .lean();
}

export type PublicProductFilter = { categoryIds?: Types.ObjectId[] };

// Plain listing — FR-CAT-054 (flat) and FR-CAT-055 (category-scoped, via
// categoryIds) share this one function; the ?q= keyword-search case below is
// a genuinely different query shape ($search must lead an aggregation
// pipeline, incompatible with a plain .find()), not a variant of this.
export async function listPublicPaginated(
  filter: PublicProductFilter,
  page: ProductListPage,
): Promise<{ items: PublicProductDoc[]; total: number }> {
  const query: QueryFilter<ProductDocument> = { status: "published" };
  if (filter.categoryIds) query.category = { $in: filter.categoryIds };

  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(page.limit)
      .populate<{ brand: PopulatedRef }>("brand", "name slug")
      .populate<{ category: PopulatedRef }>("category", "name slug")
      .lean(),
    Product.countDocuments(query),
  ]);

  return { items, total };
}

// FR-CAT-065: MongoDB Atlas Search keyword search over name/description,
// fuzzy-matched — see backend/atlas-search/README.md for the index this
// depends on (named "products_search", provisioned against the `products`
// collection; a real Atlas-cluster setup step, not something this code can
// create). $search must be the pipeline's first stage; $match narrows to
// published (and, when scoped, to categoryIds) after scoring, and $facet
// runs the paginated slice and the total count in one round trip.
export async function searchPublicPaginated(
  q: string,
  filter: PublicProductFilter,
  page: ProductListPage,
): Promise<{ items: PublicProductDoc[]; total: number }> {
  const matchStage: QueryFilter<ProductDocument> = { status: "published" };
  if (filter.categoryIds) matchStage.category = { $in: filter.categoryIds };

  const skip = (page.page - 1) * page.limit;
  const [result] = await Product.aggregate<{
    items: ProductRecord[];
    totalCount: { count: number }[];
  }>([
    {
      $search: {
        index: "products_search",
        text: { query: q, path: ["name", "description"], fuzzy: {} },
      },
    },
    { $match: matchStage },
    {
      // No explicit $sort here — $search already returns documents in
      // relevance order, and neither $match nor $skip/$limit reorders
      // within a $facet sub-pipeline, so omitting it keeps relevance order
      // while sidestepping Mongoose's PipelineStage type not (yet)
      // recognizing $meta: "searchScore" as a valid sort key.
      $facet: {
        items: [{ $skip: skip }, { $limit: page.limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const items = result?.items ?? [];
  const total = result?.totalCount[0]?.count ?? 0;

  const populated = await Product.populate<{ brand: PopulatedRef; category: PopulatedRef }>(
    items,
    [
      { path: "brand", select: "name slug" },
      { path: "category", select: "name slug" },
    ],
  );

  return { items: populated as unknown as PublicProductDoc[], total };
}

export async function slugExists(slug: string): Promise<boolean> {
  const existing = await Product.exists({ slug });
  return existing !== null;
}

// FR-CAT-003's namespace spans both a top-level field and an array field on
// the same collection — no single index can enforce that, so this is the
// application-level half of the cross-check the unique indexes alone can't
// provide. `excludeId` lets update calls exclude the product being updated
// from colliding with its own stored SKU (SKU itself is never actually
// editable — see products.service.ts — but this stays generic for #32's
// variant-SKU writes, which will need the same exclusion shape).
export async function skuInUse(sku: string, excludeId?: Types.ObjectId): Promise<boolean> {
  const filter: QueryFilter<ProductDocument> = { $or: [{ sku }, { "variants.sku": sku }] };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Product.exists(filter);
  return existing !== null;
}

// Wrapped in $set, same reasoning as brands/categories' updateById — a plain
// update document with no operator keys is a full replacement in MongoDB,
// not a partial update.
export async function updateById(
  id: Types.ObjectId,
  patch: UpdateProductDoc,
): Promise<ProductRecord | null> {
  return Product.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
}

// Full-array replace — same reasoning as categorySpecifications'/
// categoryVariants' replaceGroups/replaceAxes: MongoDB positional array
// update operators are brittle for a low-traffic admin tool, so the service
// layer mutates a plain in-memory copy of `variants` and this persists the
// whole array in one write. Kept separate from updateById/UpdateProductDoc
// since products.controller.ts never accepts `variants` directly — only
// addVariant/updateVariant in products.service.ts write through here.
export async function replaceVariants(
  id: Types.ObjectId,
  variants: ProductVariant[],
): Promise<ProductRecord | null> {
  return Product.findByIdAndUpdate(id, { $set: { variants } }, { new: true }).lean();
}

export type ProductListFilter = {
  lowStock?: boolean;
  search?: string | undefined;
  status?: ProductStatus | undefined;
};
export type ProductSortField = "createdAt" | "name" | "mrp" | "stock";
export type ProductListSort = { field: ProductSortField; order: 1 | -1 };
export type ProductListPage = { page: number; limit: number };

export async function listPaginated(
  filter: ProductListFilter,
  sort: ProductListSort,
  page: ProductListPage,
): Promise<{ items: ProductRecord[]; total: number }> {
  const query: QueryFilter<ProductDocument> = {};
  // $expr is required here — comparing two fields of the same document
  // (stock vs. its own lowStockThreshold) can't be expressed as a plain
  // query-operator filter.
  if (filter.lowStock) query.$expr = { $lte: ["$stock", "$lowStockThreshold"] };
  // FR-CAT-053: search stays over all statuses (the admin grid's existing
  // all-statuses visibility rule) unless a status filter narrows it further.
  if (filter.status) query.status = filter.status;
  // FR-CAT-050: name is an unanchored, case-insensitive partial match; sku is
  // anchored at the start (exact-or-prefix) so pasting a full sku returns
  // exactly that product. A plain MongoDB regex, not Atlas Search — see
  // docs/srs/features/0.2-product-catalog.md's note accepting the resulting
  // name-side collection scan at this catalog's scale.
  if (filter.search) {
    const escaped = escapeRegExp(filter.search);
    query.$or = [{ name: { $regex: escaped, $options: "i" } }, { sku: { $regex: `^${escaped}` } }];
  }

  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Product.find(query)
      .sort({ [sort.field]: sort.order })
      .skip(skip)
      .limit(page.limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  return { items, total };
}

// Only what brands (#27) and categories (#28) need: a per-entity delete
// guard and a bulk count for each admin list. No other product queries exist
// yet — #31 owns the rest.

export async function countByBrand(brandId: Types.ObjectId): Promise<number> {
  return Product.countDocuments({ brand: brandId });
}

/**
 * Bulk per-brand counts for the admin brand list, in one aggregation instead
 * of N queries. Brands with zero products simply don't appear in the map —
 * callers should default to 0 for any id missing from it.
 */
export async function countByBrandIds(brandIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const results = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { brand: { $in: brandIds } } },
    { $group: { _id: "$brand", count: { $sum: 1 } } },
  ]);

  return new Map(results.map((r) => [r._id.toString(), r.count]));
}

export async function countByCategory(categoryId: Types.ObjectId): Promise<number> {
  return Product.countDocuments({ category: categoryId });
}

/**
 * Bulk per-category counts for the admin category list — same shape as
 * countByBrandIds. Categories with zero products don't appear in the map;
 * callers should default to 0 for any id missing from it.
 */
export async function countByCategoryIds(
  categoryIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  const results = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { category: { $in: categoryIds } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  return new Map(results.map((r) => [r._id.toString(), r.count]));
}

// The `category` filter is load-bearing, not defensive: two categories can
// each define a same-named field, and a product's specifications are only
// ever valid against its own category's schema (FR-CAT-034) — omitting it
// would let another category's same-named field inflate the count.
export async function countBySpecificationField(
  categoryId: Types.ObjectId,
  groupName: string,
  name: string,
): Promise<number> {
  return Product.countDocuments({
    category: categoryId,
    specifications: { $elemMatch: { groupName, values: { $elemMatch: { name } } } },
  });
}
