import type { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { findById as findCategoryById } from "@/modules/categories/categories.repository";
import type { VariantAxis } from "./categoryVariants.model";
import { findByCategory, replaceAxes, deleteByCategory } from "./categoryVariants.repository";

export type CategoryVariantsView = {
  category: Types.ObjectId;
  variants: VariantAxis[];
};

// PATCH only ever targets an axis that already exists (FR-CAT-037's verbs
// are "update or delete," never "create") — new axes are added via PUT
// (defineVariantAxes), same split as categorySpecifications' SpecPatchOperation.
// Matched on `code` rather than `name`: unlike a specification field (which
// has only a name), an axis carries both a display `name` and a `code`, and
// FR-CAT-037 says this definition is never enforced against stored variant
// attributes — so renaming an axis (including its code) can't orphan anything
// downstream the way renaming a specification field could.
export type VariantAxisPatchOperation =
  { op: "updateAxis"; code: string; axis: VariantAxis } | { op: "deleteAxis"; code: string };

function categoryNotFound(id: Types.ObjectId): AppError {
  return new AppError(404, "CATEGORY_NOT_FOUND", `Category ${id.toString()} was not found.`);
}

function axisNotFound(code: string): AppError {
  return new AppError(404, "VARIANT_AXIS_NOT_FOUND", `Variant axis "${code}" was not found.`);
}

function duplicateAxis(code: string): AppError {
  return new AppError(400, "DUPLICATE_VARIANT_AXIS", `An axis with code "${code}" already exists.`);
}

// Every operation on this resource confirms the category itself exists
// first, same reasoning as categorySpecifications.service.ts's
// assertCategoryExists — the URL's :id is a category id.
async function assertCategoryExists(categoryId: Types.ObjectId): Promise<void> {
  const category = await findCategoryById(categoryId);
  if (!category) throw categoryNotFound(categoryId);
}

// Beyond the SRS's literal text, but necessary for PATCH's `code` match
// target to be unambiguous — same reasoning as categorySpecifications'
// assertNoDuplicateGroups/assertNoDuplicateFields.
function assertNoDuplicateAxes(axes: VariantAxis[]): void {
  const seen = new Set<string>();
  for (const axis of axes) {
    if (seen.has(axis.code)) throw duplicateAxis(axis.code);
    seen.add(axis.code);
  }
}

async function loadAxes(categoryId: Types.ObjectId): Promise<VariantAxis[]> {
  const doc = await findByCategory(categoryId);
  return doc ? doc.variants : [];
}

export async function getVariantAxes(categoryId: Types.ObjectId): Promise<CategoryVariantsView> {
  await assertCategoryExists(categoryId);
  const variants = await loadAxes(categoryId);
  return { category: categoryId, variants };
}

export async function defineVariantAxes(
  categoryId: Types.ObjectId,
  axes: VariantAxis[],
): Promise<CategoryVariantsView> {
  await assertCategoryExists(categoryId);
  assertNoDuplicateAxes(axes);

  const doc = await replaceAxes(categoryId, axes);
  return { category: doc.category, variants: doc.variants };
}

export async function updateVariantAxes(
  categoryId: Types.ObjectId,
  operation: VariantAxisPatchOperation,
): Promise<CategoryVariantsView> {
  await assertCategoryExists(categoryId);
  const axes = await loadAxes(categoryId);
  const updatedAxes = applyOperation(axes, operation);

  const doc = await replaceAxes(categoryId, updatedAxes);
  return { category: doc.category, variants: doc.variants };
}

function applyOperation(axes: VariantAxis[], operation: VariantAxisPatchOperation): VariantAxis[] {
  switch (operation.op) {
    case "updateAxis":
      return updateAxis(axes, operation.code, operation.axis);
    case "deleteAxis":
      return deleteAxis(axes, operation.code);
  }
}

function updateAxis(axes: VariantAxis[], code: string, axis: VariantAxis): VariantAxis[] {
  const index = axes.findIndex((a) => a.code === code);
  if (index === -1) throw axisNotFound(code);

  if (axis.code !== code && axes.some((a) => a.code === axis.code)) {
    throw duplicateAxis(axis.code);
  }

  const updated = [...axes];
  updated[index] = axis;
  return updated;
}

// No in-use guard, unlike categorySpecifications' deleteField/deleteGroup —
// FR-CAT-037 is explicit that a variant axis's definition drives admin form
// rendering only and is never enforced against stored variant attributes, so
// deletion always succeeds even while products hold variants using it.
function deleteAxis(axes: VariantAxis[], code: string): VariantAxis[] {
  const index = axes.findIndex((a) => a.code === code);
  if (index === -1) throw axisNotFound(code);

  return axes.filter((_axis, i) => i !== index);
}

export async function deleteForCategory(categoryId: Types.ObjectId): Promise<void> {
  await deleteByCategory(categoryId);
}
