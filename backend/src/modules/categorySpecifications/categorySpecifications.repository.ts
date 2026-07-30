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
