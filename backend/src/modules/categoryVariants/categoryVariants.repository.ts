import type { Types } from "mongoose";
import {
  CategoryVariants,
  type CategoryVariantsDocument,
  type VariantAxis,
} from "./categoryVariants.model";

export type CategoryVariantsRecord = CategoryVariantsDocument & { _id: Types.ObjectId };

export async function findByCategory(
  categoryId: Types.ObjectId,
): Promise<CategoryVariantsRecord | null> {
  return CategoryVariants.findOne({ category: categoryId }).lean();
}

// Full-replace upsert — the one write path both PUT and PATCH persist
// through, same reasoning as categorySpecifications.repository.ts's
// replaceGroups (MongoDB positional array update operators are brittle at
// this nesting depth for a low-traffic admin tool).
export async function replaceAxes(
  categoryId: Types.ObjectId,
  variants: VariantAxis[],
): Promise<CategoryVariantsRecord> {
  const record = await CategoryVariants.findOneAndUpdate(
    { category: categoryId },
    { $set: { variants }, $setOnInsert: { category: categoryId } },
    { upsert: true, new: true },
  ).lean();
  // upsert: true + new: true guarantees a document is always returned.
  return record as CategoryVariantsRecord;
}

export async function deleteByCategory(categoryId: Types.ObjectId): Promise<void> {
  await CategoryVariants.deleteOne({ category: categoryId });
}
