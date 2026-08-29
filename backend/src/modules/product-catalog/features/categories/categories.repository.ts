import type { QueryFilter, Types } from "mongoose";
import { escapeRegExp } from "@/utils/text";
import { Category, type CategoryDocument, type CategoryImage } from "./categories.model";

export type CategoryRecord = CategoryDocument & { _id: Types.ObjectId };

export type CreateCategoryDoc = {
  name: string;
  slug: string;
  parentCategory?: Types.ObjectId | null;
  image?: CategoryImage;
  description?: string;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
  createdBy: Types.ObjectId;
};

// status isn't part of CreateCategoryDoc — a category is always created
// active (FR-CAT-046's toggle is a dedicated PATCH .../status path, #33, not
// something set at create time). updatedBy isn't part of CreateCategoryDoc
// either (createdBy is set once, at create) but every UpdateCategoryDoc
// write carries one (Issue #143/M3.5, FR-AUTH-031-035).
export type UpdateCategoryDoc = Partial<Omit<CreateCategoryDoc, "createdBy">> & {
  status?: boolean;
  updatedBy: Types.ObjectId;
};

export async function create(doc: CreateCategoryDoc): Promise<CategoryRecord> {
  const category = await Category.create(doc);
  return category.toObject();
}

export async function findById(id: Types.ObjectId): Promise<CategoryRecord | null> {
  return Category.findById(id).lean();
}

export async function slugExists(slug: string): Promise<boolean> {
  const existing = await Category.exists({ slug });
  return existing !== null;
}

// Wrapped in $set: a plain object with no operator keys is treated by
// MongoDB as a full replacement document, not a partial update — it would
// silently drop every field not present in `patch` (including `slug`,
// which has no default and no validators run on findByIdAndUpdate by
// default). $set guarantees partial-update semantics regardless of what's
// omitted, and lets an explicit `parentCategory: null` still clear the
// field (distinct from the key being absent from `patch` entirely).
export async function updateById(
  id: Types.ObjectId,
  patch: UpdateCategoryDoc,
): Promise<CategoryRecord | null> {
  return Category.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean();
}

export async function deleteById(id: Types.ObjectId): Promise<void> {
  await Category.findByIdAndDelete(id);
}

// Issue #104: the admin list's sortable-field allow-list — reused by
// categories.controller.ts's Zod schema and its parseQuery call.
export const CATEGORY_SORT_FIELDS = ["name", "sortOrder", "createdAt"] as const;
export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];
export type CategoryListSort = { field: CategorySortField; order: 1 | -1 };
export type CategoryListPage = { page: number; limit: number };

// FR-CAT-017/051 (#104: now paginated/sortable, previously an unfiltered
// full list) — filter (built by parseQuery, name search included) and sort
// both arrive pre-built from the controller, same layering `products.repository.ts`'s
// listPaginated already established.
export async function list(
  filter: QueryFilter<CategoryDocument>,
  sort: CategoryListSort | undefined,
  page: CategoryListPage,
): Promise<{ items: CategoryRecord[]; total: number }> {
  const skip = (page.page - 1) * page.limit;
  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort(sort ? { [sort.field]: sort.order } : undefined)
      .skip(skip)
      .limit(page.limit)
      .lean(),
    Category.countDocuments(filter),
  ]);
  return { items, total };
}

// FR-CAT-066: search is a second, optional parameter on the same active-only
// query rather than a parallel function — "list active categories" and
// "search active categories by name" differ only in whether a name filter is
// applied, same relationship admin's list()/search param has to its own
// unfiltered list.
export async function listActive(search?: string): Promise<CategoryRecord[]> {
  const query: QueryFilter<CategoryDocument> = { status: true };
  if (search) query.name = { $regex: escapeRegExp(search), $options: "i" };
  return Category.find(query).sort({ sortOrder: 1, name: 1 }).lean();
}

export async function findActiveBySlug(slug: string): Promise<CategoryRecord | null> {
  return Category.findOne({ slug, status: true }).lean();
}

// Direct (one-level) active children only — categories are at most two
// levels deep, so a parent's children never have children of their own.
export async function listActiveChildIds(parentId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const children = await Category.find({ parentCategory: parentId, status: true }, { _id: 1 }).lean();
  return children.map((child) => child._id);
}

export async function countByParent(parentId: Types.ObjectId): Promise<number> {
  return Category.countDocuments({ parentCategory: parentId });
}

// Issue #172/M7.2 (FR-DASH-007) — live total/active counts for the admin
// catalog summary dashboard, no denormalized counter anywhere.
export async function countTotalsByStatus(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    Category.countDocuments({}),
    Category.countDocuments({ status: true }),
  ]);
  return { total, active };
}
