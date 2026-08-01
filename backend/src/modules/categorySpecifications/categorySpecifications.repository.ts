import type { Types } from "mongoose";
import {
  CategorySpecifications,
  type CategorySpecificationsDocument,
  type SpecificationGroup,
} from "./categorySpecifications.model";

export type CategorySpecificationsRecord = CategorySpecificationsDocument & { _id: Types.ObjectId };

export async function findByCategory(
  categoryId: Types.ObjectId,
): Promise<CategorySpecificationsRecord | null> {
  return CategorySpecifications.findOne({ category: categoryId }).lean();
}

// Bulk lookup for the buyer listing's card-content computation (#36,
// FR-CAT-092) — one query for a whole result page instead of N. A category
// with no specification document simply has no entry in the returned map;
// callers should default to an empty field list for any id missing from it.
export async function findByCategoryIds(
  categoryIds: Types.ObjectId[],
): Promise<Map<string, SpecificationGroup[]>> {
  const docs = await CategorySpecifications.find({ category: { $in: categoryIds } }).lean();
  return new Map(docs.map((doc) => [doc.category.toString(), doc.specificationGroups]));
}

// Full-replace upsert — the one write path both PUT and PATCH persist
// through (see categorySpecifications.service.ts for why PATCH doesn't use
// MongoDB's positional array update operators).
export async function replaceGroups(
  categoryId: Types.ObjectId,
  specificationGroups: SpecificationGroup[],
): Promise<CategorySpecificationsRecord> {
  const record = await CategorySpecifications.findOneAndUpdate(
    { category: categoryId },
    { $set: { specificationGroups }, $setOnInsert: { category: categoryId } },
    { upsert: true, new: true },
  ).lean();
  // upsert: true + new: true guarantees a document is always returned.
  return record as CategorySpecificationsRecord;
}

export async function deleteByCategory(categoryId: Types.ObjectId): Promise<void> {
  await CategorySpecifications.deleteOne({ category: categoryId });
}
