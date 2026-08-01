import type { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { findById as findCategoryById } from "@/modules/product-catalog/features/categories/categories.repository";
import { countBySpecificationField } from "@/modules/product-catalog/features/products/products.repository";
import type { SpecificationField, SpecificationGroup } from "./categorySpecifications.model";
import {
  findByCategory,
  findByCategoryIds,
  replaceGroups,
  deleteByCategory,
} from "./categorySpecifications.repository";

export type CategorySpecificationsView = {
  category: Types.ObjectId;
  specificationGroups: SpecificationGroup[];
};

// Deliberately decoupled from products.model.ts's ProductSpecificationGroup/
// ProductSpecificationValue rather than importing them — the two types are
// structurally compatible, and importing would make this module reach into
// products.model.ts for a type only, on top of the existing
// products.repository value import below.
export type SubmittedSpecificationValue = { name: string; value: string | number | boolean };
export type SubmittedSpecificationGroup = {
  groupName: string;
  values: SubmittedSpecificationValue[];
};

// PATCH only ever operates on things that already exist (FR-CAT-031's verbs
// are "update or delete," never "create") — new groups/fields are added via
// PUT (defineSpecifications).
export type SpecPatchOperation =
  | { op: "renameGroup"; groupName: string; newGroupName: string }
  | { op: "deleteGroup"; groupName: string }
  | { op: "updateField"; groupName: string; name: string; field: SpecificationField }
  | { op: "deleteField"; groupName: string; name: string };

function categoryNotFound(id: Types.ObjectId): AppError {
  return new AppError(404, "CATEGORY_NOT_FOUND", `Category ${id.toString()} was not found.`);
}

function groupNotFound(groupName: string): AppError {
  return new AppError(
    404,
    "SPECIFICATION_GROUP_NOT_FOUND",
    `Specification group "${groupName}" was not found.`,
  );
}

function fieldNotFound(groupName: string, name: string): AppError {
  return new AppError(
    404,
    "SPECIFICATION_FIELD_NOT_FOUND",
    `Specification field "${name}" was not found in group "${groupName}".`,
  );
}

function duplicateGroup(groupName: string): AppError {
  return new AppError(
    400,
    "DUPLICATE_SPECIFICATION_GROUP",
    `A group named "${groupName}" already exists.`,
  );
}

function duplicateField(groupName: string, name: string): AppError {
  return new AppError(
    400,
    "DUPLICATE_SPECIFICATION_FIELD",
    `A field named "${name}" already exists in group "${groupName}".`,
  );
}

// Every operation on this resource confirms the category itself exists
// first — the URL's :id is a category id, and this should 404 the same way
// GET /api/admin/categories/:id would for a nonexistent one.
async function assertCategoryExists(categoryId: Types.ObjectId): Promise<void> {
  const category = await findCategoryById(categoryId);
  if (!category) throw categoryNotFound(categoryId);
}

// Beyond the SRS's literal text, but necessary for FR-CAT-031's "matched on
// groupName + name" guard to be unambiguous — a duplicate name would make
// the match target uncertain.
function assertNoDuplicateGroups(groups: SpecificationGroup[]): void {
  const seenGroups = new Set<string>();
  for (const group of groups) {
    if (seenGroups.has(group.groupName)) throw duplicateGroup(group.groupName);
    seenGroups.add(group.groupName);
    assertNoDuplicateFields(group.groupName, group.specifications);
  }
}

function assertNoDuplicateFields(groupName: string, fields: SpecificationField[]): void {
  const seenFields = new Set<string>();
  for (const field of fields) {
    if (seenFields.has(field.name)) throw duplicateField(groupName, field.name);
    seenFields.add(field.name);
  }
}

async function loadGroups(categoryId: Types.ObjectId): Promise<SpecificationGroup[]> {
  const doc = await findByCategory(categoryId);
  return doc ? doc.specificationGroups : [];
}

export async function getSpecifications(
  categoryId: Types.ObjectId,
): Promise<CategorySpecificationsView> {
  await assertCategoryExists(categoryId);
  const specificationGroups = await loadGroups(categoryId);
  return { category: categoryId, specificationGroups };
}

export async function defineSpecifications(
  categoryId: Types.ObjectId,
  groups: SpecificationGroup[],
): Promise<CategorySpecificationsView> {
  await assertCategoryExists(categoryId);
  assertNoDuplicateGroups(groups);

  const doc = await replaceGroups(categoryId, groups);
  return { category: doc.category, specificationGroups: doc.specificationGroups };
}

export async function updateSpecifications(
  categoryId: Types.ObjectId,
  operation: SpecPatchOperation,
): Promise<CategorySpecificationsView> {
  await assertCategoryExists(categoryId);
  const groups = await loadGroups(categoryId);
  const updatedGroups = await applyOperation(categoryId, groups, operation);

  const doc = await replaceGroups(categoryId, updatedGroups);
  return { category: doc.category, specificationGroups: doc.specificationGroups };
}

async function applyOperation(
  categoryId: Types.ObjectId,
  groups: SpecificationGroup[],
  operation: SpecPatchOperation,
): Promise<SpecificationGroup[]> {
  switch (operation.op) {
    case "renameGroup":
      return renameGroup(groups, operation.groupName, operation.newGroupName);
    case "deleteGroup":
      return deleteGroup(categoryId, groups, operation.groupName);
    case "updateField":
      return updateField(groups, operation.groupName, operation.name, operation.field);
    case "deleteField":
      return deleteField(categoryId, groups, operation.groupName, operation.name);
  }
}

function renameGroup(
  groups: SpecificationGroup[],
  groupName: string,
  newGroupName: string,
): SpecificationGroup[] {
  const index = groups.findIndex((group) => group.groupName === groupName);
  if (index === -1) throw groupNotFound(groupName);

  if (newGroupName !== groupName && groups.some((group) => group.groupName === newGroupName)) {
    throw duplicateGroup(newGroupName);
  }

  const updated = [...groups];
  updated[index] = { ...updated[index]!, groupName: newGroupName };
  return updated;
}

// Guarded the same way deleteField is, even though FR-CAT-031's guard
// sentence only names field-level deletion — mirrors FR-CAT-019's category
// delete guard already being "blocked by what's nested beneath it," and
// silently letting a group delete orphan referenced field data would be a
// worse failure mode than an extra confirmation step.
async function deleteGroup(
  categoryId: Types.ObjectId,
  groups: SpecificationGroup[],
  groupName: string,
): Promise<SpecificationGroup[]> {
  const index = groups.findIndex((group) => group.groupName === groupName);
  if (index === -1) throw groupNotFound(groupName);

  const group = groups[index]!;
  const blocking: { name: string; count: number }[] = [];
  for (const field of group.specifications) {
    const count = await countBySpecificationField(categoryId, groupName, field.name);
    if (count > 0) blocking.push({ name: field.name, count });
  }
  if (blocking.length > 0) {
    const parts = blocking.map((b) => `"${b.name}" referenced by ${b.count} product(s)`);
    throw new AppError(
      409,
      "SPECIFICATION_FIELD_IN_USE",
      `Cannot delete group "${groupName}": ${parts.join(", ")}.`,
    );
  }

  return groups.filter((_group, i) => i !== index);
}

function updateField(
  groups: SpecificationGroup[],
  groupName: string,
  name: string,
  field: SpecificationField,
): SpecificationGroup[] {
  const groupIndex = groups.findIndex((group) => group.groupName === groupName);
  if (groupIndex === -1) throw groupNotFound(groupName);

  const group = groups[groupIndex]!;
  const fieldIndex = group.specifications.findIndex((f) => f.name === name);
  if (fieldIndex === -1) throw fieldNotFound(groupName, name);

  if (field.name !== name && group.specifications.some((f) => f.name === field.name)) {
    throw duplicateField(groupName, field.name);
  }

  const updatedSpecifications = [...group.specifications];
  updatedSpecifications[fieldIndex] = field;

  const updatedGroups = [...groups];
  updatedGroups[groupIndex] = { ...group, specifications: updatedSpecifications };
  return updatedGroups;
}

async function deleteField(
  categoryId: Types.ObjectId,
  groups: SpecificationGroup[],
  groupName: string,
  name: string,
): Promise<SpecificationGroup[]> {
  const groupIndex = groups.findIndex((group) => group.groupName === groupName);
  if (groupIndex === -1) throw groupNotFound(groupName);

  const group = groups[groupIndex]!;
  const fieldIndex = group.specifications.findIndex((f) => f.name === name);
  if (fieldIndex === -1) throw fieldNotFound(groupName, name);

  const count = await countBySpecificationField(categoryId, groupName, name);
  if (count > 0) {
    throw new AppError(
      409,
      "SPECIFICATION_FIELD_IN_USE",
      `Cannot delete field "${name}": referenced by ${count} product(s).`,
    );
  }

  const updatedSpecifications = group.specifications.filter((_field, i) => i !== fieldIndex);
  const updatedGroups = [...groups];
  updatedGroups[groupIndex] = { ...group, specifications: updatedSpecifications };
  return updatedGroups;
}

// Safe without its own guard: deleteCategory's own productCount === 0 check
// already guarantees no product references any field in this category's
// schema by the time this runs.
export async function deleteForCategory(categoryId: Types.ObjectId): Promise<void> {
  await deleteByCategory(categoryId);
}

function specValidationFailed(parts: string[]): AppError {
  return new AppError(
    400,
    "SPECIFICATION_VALIDATION_FAILED",
    `Specifications do not satisfy the category's schema: ${parts.join("; ")}.`,
  );
}

function specTypeMatches(field: SpecificationField, value: string | number | boolean): boolean {
  switch (field.type) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && (field.options ?? []).includes(value);
  }
}

// FR-CAT-032/034's shared validator, called by products.service.ts on both
// create and category-changing update — the one deliberate service-to-service
// import in the opposite direction of the categories cascade above (safe:
// this module never imports products.service.ts, only products.repository.ts
// for countBySpecificationField, so there's no cycle). Matches on
// groupName + name, same key shape as the PATCH operations above; identifies
// every offending field in one error rather than failing on the first (same
// house style as deleteGroup's blocking-field list).
export async function validateProductSpecifications(
  categoryId: Types.ObjectId,
  specifications: SubmittedSpecificationGroup[],
): Promise<void> {
  const schemaGroups = await loadGroups(categoryId);
  const schema = new Map<string, SpecificationField>();
  for (const group of schemaGroups) {
    for (const field of group.specifications) {
      schema.set(`${group.groupName}::${field.name}`, field);
    }
  }

  const submitted = new Set<string>();
  const unknown: string[] = [];
  const invalid: string[] = [];

  for (const group of specifications) {
    for (const value of group.values) {
      const key = `${group.groupName}::${value.name}`;
      submitted.add(key);

      const field = schema.get(key);
      if (!field) {
        unknown.push(value.name);
      } else if (!specTypeMatches(field, value.value)) {
        invalid.push(value.name);
      }
    }
  }

  const missing: string[] = [];
  for (const group of schemaGroups) {
    for (const field of group.specifications) {
      if (field.required && !submitted.has(`${group.groupName}::${field.name}`)) {
        missing.push(field.name);
      }
    }
  }

  if (missing.length === 0 && unknown.length === 0 && invalid.length === 0) return;

  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing required field(s): ${missing.join(", ")}`);
  if (unknown.length > 0) parts.push(`unknown field(s): ${unknown.join(", ")}`);
  if (invalid.length > 0) parts.push(`invalid value for field(s): ${invalid.join(", ")}`);
  throw specValidationFailed(parts);
}

export type CardSpecificationField = { name: string; unit?: string };

// FR-CAT-092: the first four *filterable* fields per category, in schema
// declaration order — computed in bulk for a whole listing page (#36's
// products.service.ts is the one consumer). Matched against a product's own
// specifications by name only (not groupName + name) when building the
// actual card values, same simplification getFilterableFieldsByCategory
// below documents — declaration order is preserved by iterating groups then
// fields in stored array order, exactly as they'd render in the admin editor.
export async function getCardFieldsByCategoryIds(
  categoryIds: Types.ObjectId[],
): Promise<Map<string, CardSpecificationField[]>> {
  const groupsByCategory = await findByCategoryIds(categoryIds);
  const result = new Map<string, CardSpecificationField[]>();

  for (const [categoryId, groups] of groupsByCategory) {
    const fields: CardSpecificationField[] = [];
    for (const group of groups) {
      for (const field of group.specifications) {
        if (!field.filterable) continue;
        const cardField: CardSpecificationField = { name: field.name };
        if (field.unit !== undefined) cardField.unit = field.unit;
        fields.push(cardField);
      }
    }
    result.set(categoryId, fields.slice(0, 4));
  }

  return result;
}

// FR-CAT-072/035: which specification filters a buyer is allowed to submit
// against a single category's schema, keyed by field name — used to reject
// a filter on a field that either doesn't exist or isn't filterable
// (FR-CAT-035's "text fields are never filterable" falls out naturally,
// since only filterable:true fields are included). Matched by name alone,
// not groupName + name, the same simplification the card-field lookup above
// makes — the buyer-facing filter rail has no reason to expose group
// structure, and categorySpecifications' own duplicate-name guard only
// applies within a single group, not across a whole category, so this is a
// deliberate (rare-collision-accepting) simplification, not an oversight.
export async function getFilterableFieldsByCategory(
  categoryId: Types.ObjectId,
): Promise<Map<string, SpecificationField>> {
  const groups = await loadGroups(categoryId);
  const result = new Map<string, SpecificationField>();
  for (const group of groups) {
    for (const field of group.specifications) {
      if (field.filterable) result.set(field.name, field);
    }
  }
  return result;
}
