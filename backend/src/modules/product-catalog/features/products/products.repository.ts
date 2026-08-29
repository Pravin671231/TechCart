import type { QueryFilter, Types } from "mongoose";
import { escapeRegExp } from "@/utils/text";
import {
  Product,
  type ProductDocument,
  type ProductSpecificationGroup,
  type ProductStatus,
  type ProductVariant,
} from "./products.model";

export type ProductRecord = ProductDocument & { _id: Types.ObjectId };

// #102: sku/images/mrp/discount/sellingPrice/stock/lowStockThreshold all
// removed — every sellable, priced, imaged field lives only on a variant now
// (added via the separate addVariant/replaceVariants path, never through
// create/update here).
export type CreateProductDoc = {
  name: string;
  slug: string;
  description: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  specifications: ProductSpecificationGroup[];
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: Types.ObjectId;
};

// updatedBy isn't part of CreateProductDoc (createdBy is set once, at
// create) but every UpdateProductDoc write carries one (Issue #143/M3.5,
// FR-AUTH-031-035).
export type UpdateProductDoc = Partial<Omit<CreateProductDoc, "createdBy">> & {
  status?: ProductStatus;
  updatedBy: Types.ObjectId;
};

export async function create(doc: CreateProductDoc): Promise<ProductRecord> {
  const product = await Product.create(doc);
  return product.toObject();
}

export async function findById(id: Types.ObjectId): Promise<ProductRecord | null> {
  return Product.findById(id).lean();
}

// Cart (M4, FR-CART-003/009) needs to resolve a line item's embedded variant
// by its own `_id` — there's no standalone variant collection, so this is a
// query into the `variants` array. `findByVariantId` backs the add/update
// paths' "does this variant exist at all" check; `findByVariantIds` resolves
// every line's parent product for a cart read in one round trip. Neither
// filters on `status`/`active` — the cart deliberately keeps a line whose
// variant has since been deactivated or whose product was unpublished,
// flagging it `unavailable` rather than dropping it (FR-CART-012), so the
// caller needs the full document to make that call.
export async function findByVariantId(variantId: Types.ObjectId): Promise<ProductRecord | null> {
  return Product.findOne({ "variants._id": variantId }).lean();
}

export async function findByVariantIds(variantIds: Types.ObjectId[]): Promise<ProductRecord[]> {
  if (variantIds.length === 0) return [];
  return Product.find({ "variants._id": { $in: variantIds } }).lean();
}

// Issue #189/M10.1 — batch product lookup for the admin inventory table's
// enrichment step (product name + variant sku), mirroring findByVariantIds'
// shape but keyed by the product's own _id rather than a variant's.
export async function findByIds(ids: Types.ObjectId[]): Promise<ProductRecord[]> {
  if (ids.length === 0) return [];
  return Product.find({ _id: { $in: ids } }).lean();
}

// Issue #189/M10.1 (FR-INV-002) — a brand-new warehouse needs a stock:0 row
// for every existing variant across every product, not just future ones.
// Kept here (not queried directly from inventory.service.ts) to match this
// codebase's established peer service->repository cross-module convention
// (brands.service.ts importing countByBrand, cart.service.ts importing
// findByVariantId/findByVariantIds).
export async function listAllVariantRefs(): Promise<
  { productId: Types.ObjectId; variantId: Types.ObjectId }[]
> {
  const products = await Product.find({}, { "variants._id": 1 }).lean();
  return products.flatMap((product) =>
    product.variants.map((variant) => ({ productId: product._id, variantId: variant._id })),
  );
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

// #36 (FR-CAT-068–076): the buyer listing's full filter surface. categoryIds
// is #35's original field; everything else is new. variantAttribute/
// specFilters are the two dimensions FR-CAT-071/072 route through Atlas
// Search rather than a plain query (see buildSearchFilters/
// searchPublicPaginated below) — every other field here is a plain MongoDB
// operator, composable with each other and with either query path
// (FR-CAT-076).
export type VariantAttributeFilter = { name: string; value: string };
export type SpecValueFilter = { name: string; kind: "value"; value: string | number | boolean };
export type SpecRangeFilter = { name: string; kind: "range"; min?: number; max?: number };
export type SpecFilter = SpecValueFilter | SpecRangeFilter;

export type PublicProductFilter = {
  categoryIds?: Types.ObjectId[];
  brandIds?: Types.ObjectId[];
  minPrice?: number;
  maxPrice?: number;
  onSaleOnly?: boolean;
  variantAttribute?: VariantAttributeFilter;
  specFilters?: SpecFilter[];
  // Issue #189/M10.1 (FR-INV-007/008) — every variant id with summed stock >
  // 0, resolved by the service layer (inventory.service.ts's
  // listVariantIdsWithStock) before this filter object is built.
  inStockVariantIds?: Types.ObjectId[];
};

export type PublicSort = "relevance" | "price_asc" | "price_desc" | "newest";

// #102: price range and on-sale are variant-level fields now (there's no
// top-level sellingPrice/discount left on the product) — folded into one
// $elemMatch alongside `active` so a *single* variant must satisfy every
// requested condition together, not "some variant matches price, some other
// variant matches on-sale." Returns undefined when neither is requested, so
// callers can skip adding a `variants` key to the query at all.
function buildVariantElemMatch(filter: PublicProductFilter): Record<string, unknown> | undefined {
  if (
    filter.minPrice === undefined &&
    filter.maxPrice === undefined &&
    !filter.onSaleOnly &&
    filter.inStockVariantIds === undefined
  ) {
    return undefined;
  }
  const elemMatch: Record<string, unknown> = { active: true };
  if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
    const range: { $gte?: number; $lte?: number } = {};
    if (filter.minPrice !== undefined) range.$gte = filter.minPrice;
    if (filter.maxPrice !== undefined) range.$lte = filter.maxPrice;
    elemMatch.sellingPrice = range;
  }
  if (filter.onSaleOnly) elemMatch.discount = { $gt: 0 };
  // FR-CAT-076-style composition: a single variant must satisfy price/on-sale
  // AND be in-stock together, not "some variant is in-stock, some other
  // variant matches price."
  if (filter.inStockVariantIds !== undefined) elemMatch._id = { $in: filter.inStockVariantIds };
  return elemMatch;
}

// Shared by both query paths below — every filter dimension here is a plain
// MongoDB operator. variantAttribute/specFilters never reach this function;
// they're Atlas-only (see buildSearchFilters), since they need to match a
// name/value pair against the *same* array element, not just "somewhere in
// the document," and Atlas Search's embeddedDocument operator is how that's
// expressed outside a plain $elemMatch query.
function buildMatchStage(filter: PublicProductFilter): QueryFilter<ProductDocument> {
  const query: QueryFilter<ProductDocument> = { status: "published" };
  if (filter.categoryIds) query.category = { $in: filter.categoryIds };
  if (filter.brandIds) query.brand = { $in: filter.brandIds };
  const variantElemMatch = buildVariantElemMatch(filter);
  if (variantElemMatch) query.variants = { $elemMatch: variantElemMatch };
  return query;
}

function isPriceSort(sort: PublicSort): sort is "price_asc" | "price_desc" {
  return sort === "price_asc" || sort === "price_desc";
}

// FR-CAT-075 (#102): price sorts order by each product's cheapest *active*
// variant's sellingPrice (the "starting from" price) — the same key for both
// directions, just the sort order flipped, rather than a different
// representative value per direction. There's no top-level sellingPrice
// field left to sort a plain query by, so this computes one via aggregation
// — used by both listPublicPaginated's price-sort branch below and
// searchPublicPaginated's own price-sort case.
function priceSortStages(sort: "price_asc" | "price_desc"): Record<string, unknown>[] {
  return [
    {
      $addFields: {
        sortPrice: {
          $min: {
            $map: {
              input: { $filter: { input: "$variants", as: "v", cond: "$$v.active" } },
              as: "v",
              in: "$$v.sellingPrice",
            },
          },
        },
      },
    },
    { $sort: { sortPrice: sort === "price_asc" ? 1 : -1 } },
  ];
}

// Issue #121: "newest first" orders by the *primary variant's* createdAt,
// not the product's own top-level createdAt — "primary variant" is defined
// identically to selectDefaultVariant() (products.service.ts): the
// lowest-sellingPrice *active* variant, reimplemented here in aggregation
// syntax since that JS function can't run inside a MongoDB pipeline.
// $sortArray needs MongoDB 5.2+ (confirmed available on this Atlas cluster,
// 8.0). A product with no active variants (the same documented edge case
// toPublicListItem's absent price/image fields already accept) gets a
// missing sortCreatedAt, which a -1 sort places last — not specially
// handled, consistent with how this codebase treats that edge case
// elsewhere. Shared by both listPublicPaginated and searchPublicPaginated's
// newest-fallback branch, same as priceSortStages already is.
function newestSortStages(): Record<string, unknown>[] {
  return [
    {
      $addFields: {
        sortCreatedAt: {
          $let: {
            vars: {
              primaryVariant: {
                $first: {
                  $sortArray: {
                    input: { $filter: { input: "$variants", as: "v", cond: "$$v.active" } },
                    sortBy: { sellingPrice: 1 },
                  },
                },
              },
            },
            in: "$$primaryVariant.createdAt",
          },
        },
      },
    },
    { $sort: { sortCreatedAt: -1 } },
  ];
}

// Shared tail for every aggregation-based listing path below: pull the
// $facet result apart, then populate brand/category manually — aggregation
// doesn't run schema-level populate automatically the way .find().populate()
// does.
async function runFacetedAggregate(
  pipeline: Record<string, unknown>[],
): Promise<{ items: PublicProductDoc[]; total: number }> {
  const [result] = await Product.aggregate<{
    items: ProductRecord[];
    totalCount: { count: number }[];
  }>(pipeline as unknown as Parameters<typeof Product.aggregate>[0]);

  const items = result?.items ?? [];
  const total = result?.totalCount[0]?.count ?? 0;

  const populated = await Product.populate<{ brand: PopulatedRef; category: PopulatedRef }>(items, [
    { path: "brand", select: "name slug" },
    { path: "category", select: "name slug" },
  ]);

  return { items: populated as unknown as PublicProductDoc[], total };
}

// Plain listing — FR-CAT-054 (flat) and FR-CAT-055 (category-scoped, via
// categoryIds) share this one function; the Atlas Search case below is a
// genuinely different query shape ($search must lead an aggregation
// pipeline, incompatible with a plain .find()), not a variant of this.
// Always aggregation-based (Issue #121 removed the old plain
// .find().sort({createdAt:-1}) path) — both price sorts and the
// newest-first default need a computed-per-product sort key derived from
// `variants`, since #102 left no top-level field on the product itself to
// sort by directly.
export async function listPublicPaginated(
  filter: PublicProductFilter,
  sort: PublicSort,
  page: ProductListPage,
): Promise<{ items: PublicProductDoc[]; total: number }> {
  const query = buildMatchStage(filter);
  const skip = (page.page - 1) * page.limit;

  const sortStages = isPriceSort(sort) ? priceSortStages(sort) : newestSortStages();
  const pipeline = [
    { $match: query },
    ...sortStages,
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: page.limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ];
  return runFacetedAggregate(pipeline);
}

// FR-CAT-071/072: a variant-attribute or filterable-specification filter,
// each expressed as a nested embeddedDocument operator so "name X and value
// Y on the same array element" is enforced the way $elemMatch enforces it in
// a plain query — a top-level equals on each path independently would also
// match a product where X and Y appear on *different* elements.
function buildSearchFilters(filter: PublicProductFilter): Record<string, unknown>[] {
  const filters: Record<string, unknown>[] = [];

  if (filter.variantAttribute) {
    const variantClauses: Record<string, unknown>[] = [
      { equals: { path: "variants.active", value: true } },
      {
        embeddedDocument: {
          path: "variants.attributes",
          operator: {
            compound: {
              filter: [
                {
                  equals: {
                    path: "variants.attributes.name",
                    value: filter.variantAttribute.name,
                  },
                },
                {
                  equals: {
                    path: "variants.attributes.value",
                    value: filter.variantAttribute.value,
                  },
                },
              ],
            },
          },
        },
      },
    ];
    // #102: when combined with an attribute filter, price range/on-sale
    // apply to that *same* matched variant element, not "any variant"
    // independently — same same-element semantics buildVariantElemMatch
    // enforces for the plain query path above.
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (filter.minPrice !== undefined) range.gte = filter.minPrice;
      if (filter.maxPrice !== undefined) range.lte = filter.maxPrice;
      variantClauses.push({ range: { path: "variants.sellingPrice", ...range } });
    }
    if (filter.onSaleOnly) {
      variantClauses.push({ range: { path: "variants.discount", gt: 0 } });
    }

    filters.push({
      embeddedDocument: {
        path: "variants",
        operator: { compound: { filter: variantClauses } },
      },
    });
  }

  for (const spec of filter.specFilters ?? []) {
    // FR-CAT-072: enum/boolean match by exact value; number filters by
    // range — either bound alone is valid ("at least" / "at most").
    const valueClauses: Record<string, unknown>[] =
      spec.kind === "value"
        ? [{ equals: { path: "specifications.values.value", value: spec.value } }]
        : [
            ...(spec.min !== undefined
              ? [{ range: { path: "specifications.values.value", gte: spec.min } }]
              : []),
            ...(spec.max !== undefined
              ? [{ range: { path: "specifications.values.value", lte: spec.max } }]
              : []),
          ];

    filters.push({
      embeddedDocument: {
        path: "specifications.values",
        operator: {
          compound: {
            filter: [
              { equals: { path: "specifications.values.name", value: spec.name } },
              ...valueClauses,
            ],
          },
        },
      },
    });
  }

  return filters;
}

// FR-CAT-065/071/072: MongoDB Atlas Search — keyword search (fuzzy, over
// name/description) and/or variant-attribute/specification filtering, both
// riding the same $search stage since Atlas Search requires it to lead the
// pipeline. See backend/atlas-search/README.md for the index this depends
// on (named "products_search"; a real Atlas-cluster provisioning step, not
// something this code can create or verify without one — the
// embeddedDocument filter shape here is this codebase's best-faith
// translation of Atlas Search's documented syntax for "array of
// subdocuments" exact/range matching, unverified against a live cluster).
// Every other filter dimension (category/brand/price/on-sale) still narrows
// via a plain $match after scoring, identical to listPublicPaginated's own
// buildMatchStage. `q` is optional — this function is also the query path
// for a variant-attribute/spec filter with no keyword search at all, since
// Atlas Search's embeddedDocument filters can't be expressed as a plain
// query.
export async function searchPublicPaginated(
  q: string | undefined,
  filter: PublicProductFilter,
  sort: PublicSort,
  page: ProductListPage,
): Promise<{ items: PublicProductDoc[]; total: number }> {
  const matchStage = buildMatchStage(filter);
  const must = q ? [{ text: { query: q, path: ["name", "description"], fuzzy: {} } }] : [];
  const searchFilters = buildSearchFilters(filter);

  const skip = (page.page - 1) * page.limit;
  const itemsPipeline: Record<string, unknown>[] = [];
  // A non-relevance sort (price/newest) always wins outright — an explicit
  // buyer choice, never overridden by search scoring. "relevance" with no
  // `q` has nothing to rank by (only attribute/spec filters, no keyword
  // search), so it falls back to newest-first too, same as the plain
  // .find() path's own default. Price sorts (#102) need the same
  // aggregation-based priceSortStages listPublicPaginated uses, since
  // there's no top-level sellingPrice field to $sort by directly.
  if (sort !== "relevance" || !q) {
    if (isPriceSort(sort)) {
      itemsPipeline.push(...priceSortStages(sort));
    } else {
      itemsPipeline.push(...newestSortStages());
    }
  }
  itemsPipeline.push({ $skip: skip }, { $limit: page.limit });

  const pipeline = [
    { $search: { compound: { must, filter: searchFilters } } },
    { $match: matchStage },
    { $facet: { items: itemsPipeline, totalCount: [{ $count: "count" }] } },
  ];

  return runFacetedAggregate(pipeline);
}

export async function slugExists(slug: string): Promise<boolean> {
  const existing = await Product.exists({ slug });
  return existing !== null;
}

// FR-CAT-003's SKU namespace is variant-only since #102 — the
// `variants.sku` unique multikey index alone is now sufficient to guarantee
// this at the DB level, but this application-level check stays so a
// collision surfaces as a friendly 400 DUPLICATE_SKU rather than a raw Mongo
// E11000 error bubbling up as a 500. `excludeId` lets update calls exclude
// the product being updated from colliding with its own stored variant SKUs.
export async function skuInUse(sku: string, excludeId?: Types.ObjectId): Promise<boolean> {
  const filter: QueryFilter<ProductDocument> = { "variants.sku": sku };
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
//
// Issue #121: goes through the raw MongoDB driver (Product.collection),
// deliberately bypassing Mongoose's schema casting — empirically confirmed
// that Mongoose's own findByIdAndUpdate() re-stamps every variant's
// createdAt/updatedAt to "now" on every $set of the whole array, even when
// the caller supplies the original values and even with the top-level
// `{timestamps:false}` update option set (that option only suppresses the
// *document's* auto-timestamps, not the subdocument-array schema's own
// casting-time defaulting). Going around Mongoose here means whatever
// timestamps products.service.ts's addVariant/updateVariant put on each
// variant are exactly what gets stored — nothing else touches them.
export async function replaceVariants(
  id: Types.ObjectId,
  variants: ProductVariant[],
  updatedBy: Types.ObjectId,
): Promise<ProductRecord | null> {
  await Product.collection.updateOne(
    { _id: id },
    { $set: { variants, updatedAt: new Date(), updatedBy } },
  );
  return findById(id);
}

export type ProductListFilter = {
  search?: string | undefined;
  status?: ProductStatus | undefined;
};
// mrp/stock dropped with #102 — the product no longer has either field.
// Issue #104: the single source of truth for the admin list's sortable
// fields, consumed both by the Mongoose enum-of-truth style below and by
// products.controller.ts's Zod schema / parseQuery call, so the two can't
// drift apart the way the old controller-local SORT_VALUES could.
export const PRODUCT_SORT_FIELDS = ["createdAt", "name"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];
export type ProductListSort = { field: ProductSortField; order: 1 | -1 };
export type ProductListPage = { page: number; limit: number };

export async function listPaginated(
  filter: ProductListFilter,
  // Issue #104: optional — orderBy:"none" means no explicit sort at all,
  // not a fallback default; Mongoose leaves natural order when .sort() is
  // never called.
  sort: ProductListSort | undefined,
  page: ProductListPage,
): Promise<{ items: ProductRecord[]; total: number }> {
  const query: QueryFilter<ProductDocument> = {};
  // FR-CAT-053: search stays over all statuses (the admin grid's existing
  // all-statuses visibility rule) unless a status filter narrows it further.
  if (filter.status) query.status = filter.status;
  // FR-CAT-050: name is an unanchored, case-insensitive partial match; sku
  // (#102: variants.sku, the product's own sku is gone) is anchored at the
  // start (exact-or-prefix) so pasting a full sku returns exactly that
  // product. A plain MongoDB regex, not Atlas Search — see
  // docs/srs/features/0.2-product-catalog.md's note accepting the resulting
  // name-side collection scan at this catalog's scale.
  if (filter.search) {
    const escaped = escapeRegExp(filter.search);
    query.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { "variants.sku": { $regex: `^${escaped}` } },
    ];
  }

  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Product.find(query)
      .sort(sort ? { [sort.field]: sort.order } : undefined)
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

// Issue #172/M7.2 (FR-DASH-007) — a live count of products by status, for
// the admin catalog summary dashboard. No caller-side default needed the way
// countByBrandIds/countByCategoryIds have (a status absent from the result
// just means zero products in that status).
export async function countByStatusGroups(): Promise<Record<string, number>> {
  const results = await Product.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(results.map((row) => [row._id, row.count]));
}
