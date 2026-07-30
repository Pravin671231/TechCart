import type { Types } from "mongoose";
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
};

export type UpdateCategoryDoc = Partial<CreateCategoryDoc>;

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

export async function list(): Promise<CategoryRecord[]> {
  return Category.find().lean();
}

export async function listActive(): Promise<CategoryRecord[]> {
  return Category.find({ status: true }).sort({ sortOrder: 1, name: 1 }).lean();
}

export async function countByParent(parentId: Types.ObjectId): Promise<number> {
  return Category.countDocuments({ parentCategory: parentId });
}
