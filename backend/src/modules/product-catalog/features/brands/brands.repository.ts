import type { QueryFilter, Types } from "mongoose";
import { Brand, type BrandDocument, type BrandLogo } from "./brands.model";

export type BrandRecord = BrandDocument & { _id: Types.ObjectId };

export type CreateBrandDoc = {
  name: string;
  slug: string;
  logo?: BrandLogo;
  description?: string;
  createdBy: Types.ObjectId;
};

// status isn't part of CreateBrandDoc — a brand is always created active
// (FR-CAT-047's toggle is a dedicated PATCH .../status path, #33, not
// something set at create time). updatedBy isn't part of CreateBrandDoc
// either (createdBy is set once, at create) but every UpdateBrandDoc write
// carries one (Issue #143/M3.5, FR-AUTH-031-035).
export type UpdateBrandDoc = Partial<Omit<CreateBrandDoc, "createdBy">> & {
  status?: boolean;
  updatedBy: Types.ObjectId;
};

export async function create(doc: CreateBrandDoc): Promise<BrandRecord> {
  const brand = await Brand.create(doc);
  return brand.toObject();
}

export async function findById(id: Types.ObjectId): Promise<BrandRecord | null> {
  return Brand.findById(id).lean();
}

export async function slugExists(slug: string): Promise<boolean> {
  const existing = await Brand.exists({ slug });
  return existing !== null;
}

// Wrapped in $set: a plain object with no operator keys is treated by
// MongoDB as a full replacement document, not a partial update — it would
// silently drop every field not present in `patch` (including `slug`,
// which has no default and no validators run on findByIdAndUpdate by
// default). $set guarantees partial-update semantics regardless of what's
// omitted.
export async function updateById(
  id: Types.ObjectId,
  patch: UpdateBrandDoc,
): Promise<BrandRecord | null> {
  return Brand.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
}

export async function deleteById(id: Types.ObjectId): Promise<void> {
  await Brand.findByIdAndDelete(id);
}

// Issue #104: the admin list's sortable-field allow-list — reused by
// brands.controller.ts's Zod schema and its parseQuery call. No sortOrder
// field exists on brands (unlike categories), so this is narrower.
export const BRAND_SORT_FIELDS = ["name", "createdAt"] as const;
export type BrandSortField = (typeof BRAND_SORT_FIELDS)[number];
export type BrandListSort = { field: BrandSortField; order: 1 | -1 };
export type BrandListPage = { page: number; limit: number };

// FR-CAT-026/052 (#104: now paginated/sortable, previously an unfiltered
// full list) — filter (built by parseQuery, name search included) and sort
// both arrive pre-built from the controller, same layering categories'/
// products' own list functions already established.
export async function list(
  filter: QueryFilter<BrandDocument>,
  sort: BrandListSort | undefined,
  page: BrandListPage,
): Promise<{ items: BrandRecord[]; total: number }> {
  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Brand.find(filter)
      .sort(sort ? { [sort.field]: sort.order } : undefined)
      .skip(skip)
      .limit(page.limit)
      .lean(),
    Brand.countDocuments(filter),
  ]);
  return { items, total };
}

export async function listActive(): Promise<BrandRecord[]> {
  return Brand.find({ status: true }).lean();
}
