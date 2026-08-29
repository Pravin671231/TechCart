import { Types, type QueryFilter } from "mongoose";
import { AppError } from "@/utils/AppError";
import { generateUniqueSlug } from "@/utils/slug";
import { truncate } from "@/utils/text";
import { buildPagination, type Pagination } from "@/utils/apiResponse";
import { consumeImageKeys, buildPublicUrl } from "@/modules/uploads/uploads.service";
import {
  countByCategory,
  countByCategoryIds,
  brandFacetsForCategories,
  priceRangeForCategories,
  specNumberRangesForCategories,
} from "@/modules/product-catalog/features/products/products.repository";
import {
  deleteForCategory as deleteSpecificationsForCategory,
  getFilterableFieldsByCategory,
} from "@/modules/product-catalog/features/categorySpecifications/categorySpecifications.service";
import {
  deleteForCategory as deleteVariantsForCategory,
  getVariantAxes,
} from "@/modules/product-catalog/features/categoryVariants/categoryVariants.service";
import type { CategoryDocument, CategoryImage } from "./categories.model";
import {
  create,
  findById,
  slugExists,
  updateById,
  deleteById,
  list,
  listActive,
  findActiveBySlug,
  listActiveChildIds,
  countByParent,
  type CategoryRecord,
  type CreateCategoryDoc,
  type UpdateCategoryDoc,
  type CategoryListSort,
  type CategoryListPage,
} from "./categories.repository";

// See brands.service.ts's CreateBrandInput for why optionals spell out
// `| undefined` explicitly under exactOptionalPropertyTypes: true.
export type CreateCategoryInput = {
  name: string;
  description?: string | undefined;
  parentCategory?: Types.ObjectId | undefined;
  image?: { objectKey: string; alt?: string | undefined } | undefined;
  sortOrder?: number | undefined;
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
};

// parentCategory is tri-state here, unlike every other field: absent (leave
// unchanged), explicit null (promote to root), or an id (set/change parent).
export type UpdateCategoryInput = {
  name?: string | undefined;
  description?: string | undefined;
  parentCategory?: Types.ObjectId | null | undefined;
  image?: { objectKey: string; alt?: string | undefined } | undefined;
  sortOrder?: number | undefined;
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
};

export type CategoryListItem = CategoryRecord & { productCount: number };

export type PublicCategory = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  parentCategory: Types.ObjectId | null;
  sortOrder: number;
  image?: CategoryImage;
  metaTitle: string;
  metaDescription: string;
};

function notFound(id: Types.ObjectId): AppError {
  return new AppError(404, "CATEGORY_NOT_FOUND", `Category ${id.toString()} was not found.`);
}

function notFoundBySlug(slug: string): AppError {
  return new AppError(404, "CATEGORY_NOT_FOUND", `Category "${slug}" was not found.`);
}

async function resolveImage(image: {
  objectKey: string;
  alt?: string | undefined;
}): Promise<CategoryImage> {
  await consumeImageKeys([image.objectKey]);
  const url = buildPublicUrl(image.objectKey);
  return image.alt !== undefined ? { url, alt: image.alt } : { url };
}

// Shared by create and update. `currentId` is only passed on update — a
// brand-new category can't already have children, so create never needs the
// has-subcategories branch below.
async function validateParentCategory(
  parentId: Types.ObjectId | null,
  currentId?: Types.ObjectId,
): Promise<void> {
  if (parentId === null) return;

  if (currentId && parentId.equals(currentId)) {
    throw new AppError(400, "INVALID_PARENT_CATEGORY", "A category cannot be its own parent.");
  }

  const parent = await findById(parentId);
  if (!parent) {
    throw new AppError(
      404,
      "PARENT_CATEGORY_NOT_FOUND",
      `Parent category ${parentId.toString()} was not found.`,
    );
  }
  if (parent.parentCategory) {
    throw new AppError(
      400,
      "PARENT_CATEGORY_TOO_DEEP",
      "The selected parent category already has a parent — categories may be at most two levels deep.",
    );
  }

  if (currentId) {
    const childCount = await countByParent(currentId);
    if (childCount > 0) {
      throw new AppError(
        400,
        "CATEGORY_HAS_SUBCATEGORIES",
        "This category already has subcategories and cannot also be given a parent.",
      );
    }
  }
}

export async function createCategory(
  input: CreateCategoryInput,
  userId: string,
): Promise<CategoryRecord> {
  await validateParentCategory(input.parentCategory ?? null);

  const slug = await generateUniqueSlug(input.name, slugExists);

  const doc: CreateCategoryDoc = { name: input.name, slug, createdBy: new Types.ObjectId(userId) };
  if (input.description !== undefined) doc.description = input.description;
  if (input.parentCategory !== undefined) doc.parentCategory = input.parentCategory;
  if (input.image) doc.image = await resolveImage(input.image);
  if (input.sortOrder !== undefined) doc.sortOrder = input.sortOrder;
  if (input.metaTitle !== undefined) doc.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) doc.metaDescription = input.metaDescription;

  return create(doc);
}

// Slug is never touched here, same reasoning as brands. parentCategory CAN
// change, unlike brands' fields — validated again via validateParentCategory
// whenever it's explicitly present in the input (including null, which
// skips validation entirely and just clears the field).
export async function updateCategory(
  id: Types.ObjectId,
  input: UpdateCategoryInput,
  userId: string,
): Promise<CategoryRecord> {
  if (input.parentCategory !== undefined) {
    await validateParentCategory(input.parentCategory, id);
  }

  const patch: UpdateCategoryDoc = { updatedBy: new Types.ObjectId(userId) };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.parentCategory !== undefined) patch.parentCategory = input.parentCategory;
  if (input.image !== undefined) patch.image = await resolveImage(input.image);
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.metaTitle !== undefined) patch.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) patch.metaDescription = input.metaDescription;

  const updated = await updateById(id, patch);
  if (!updated) throw notFound(id);
  return updated;
}

export async function getCategoryById(id: Types.ObjectId): Promise<CategoryRecord> {
  const category = await findById(id);
  if (!category) throw notFound(id);
  return category;
}

// Issue #104: paginated/sortable, previously an unfiltered full list —
// `filter` (name search included, built by parseQuery) and `sort` arrive
// pre-built from the controller, same layering products' own
// listProductsForAdmin already established.
export async function listCategoriesForAdmin(
  filter: QueryFilter<CategoryDocument>,
  sort: CategoryListSort | undefined,
  page: CategoryListPage,
): Promise<{ items: CategoryListItem[]; pagination: Pagination }> {
  const { items, total } = await list(filter, sort, page);
  const counts = await countByCategoryIds(items.map((category) => category._id));

  const withCounts = items.map((category) => ({
    ...category,
    productCount: counts.get(category._id.toString()) ?? 0,
  }));

  return { items: withCounts, pagination: buildPagination(page.page, page.limit, total) };
}

// search (FR-CAT-066) is the same active-only query with an optional name
// filter, reused by both GET /api/categories (no search) and
// GET /api/categories/search?q= (search required at the controller layer).
export async function listCategoriesForPublic(search?: string): Promise<PublicCategory[]> {
  const categories = await listActive(search);

  return categories.map((category) => {
    const metaTitle = category.metaTitle ?? category.name;
    const metaDescription =
      category.metaDescription ??
      (category.description ? truncate(category.description) : category.name);

    const publicCategory: PublicCategory = {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      parentCategory: category.parentCategory ?? null,
      sortOrder: category.sortOrder,
      metaTitle,
      metaDescription,
    };
    if (category.image) publicCategory.image = category.image;
    return publicCategory;
  });
}

// FR-CAT-055: resolves the ":slug" segment of GET /api/categories/:slug/products
// to a category and its direct active subcategories (categories are at most
// two levels deep, so "direct children" already covers the whole subtree).
// Active-only and 404 on a miss — same reasoning as listCategoriesForPublic
// only ever surfacing active categories: a deactivated category's slug
// shouldn't resolve to a buyer-visible product listing either.
export async function getActiveCategoryBySlug(slug: string): Promise<CategoryRecord> {
  const category = await findActiveBySlug(slug);
  if (!category) throw notFoundBySlug(slug);
  return category;
}

export async function listActiveSubcategoryIds(parentId: Types.ObjectId): Promise<Types.ObjectId[]> {
  return listActiveChildIds(parentId);
}

// FR-CAT-101 (Issue #326): the buyer filter rail's discovery endpoint —
// GET /api/categories/:slug/filters. Everything is scoped to the category
// plus its direct active subcategories (categories are at most two levels
// deep), the same subtree GET /api/categories/:slug/products resolves.
export type CategoryFilterOptions = {
  category: { _id: Types.ObjectId; name: string; slug: string };
  brands: { _id: Types.ObjectId; name: string; slug: string; productCount: number }[];
  priceRange: { min: number; max: number } | null;
  specifications: {
    name: string;
    unit: string | null;
    type: "enum" | "boolean" | "number";
    options?: string[];
    min?: number;
    max?: number;
  }[];
  variantAxes: { name: string; code: string; type: string; options: { label: string; value: string }[] }[];
};

export async function getCategoryFilterOptions(slug: string): Promise<CategoryFilterOptions> {
  const category = await getActiveCategoryBySlug(slug); // 404 CATEGORY_NOT_FOUND on miss/inactive
  const subcategoryIds = await listActiveSubcategoryIds(category._id);
  const categoryIds = [category._id, ...subcategoryIds];

  // Filterable specification schema is defined on the parent category only —
  // subcategories inherit no schema of their own (FR-CAT-030).
  const filterableFields = await getFilterableFieldsByCategory(category._id);
  const numberFieldNames = [...filterableFields.values()]
    .filter((field) => field.type === "number")
    .map((field) => field.name);

  const [brands, priceRange, numberRanges, variantAxesView] = await Promise.all([
    brandFacetsForCategories(categoryIds),
    priceRangeForCategories(categoryIds),
    specNumberRangesForCategories(categoryIds, numberFieldNames),
    getVariantAxes(category._id),
  ]);

  const specifications: CategoryFilterOptions["specifications"] = [];
  for (const field of filterableFields.values()) {
    // getFilterableFieldsByCategory already excludes non-filterable fields,
    // and `text` can never be filterable (FR-CAT-035) — so `type` here is
    // always enum | boolean | number.
    const type = field.type as "enum" | "boolean" | "number";
    const entry: CategoryFilterOptions["specifications"][number] = {
      name: field.name,
      unit: field.unit ?? null,
      type,
    };
    if (type === "enum" && field.options) entry.options = field.options;
    if (type === "number") {
      const range = numberRanges.get(field.name);
      if (range) {
        entry.min = range.min;
        entry.max = range.max;
      }
    }
    specifications.push(entry);
  }

  return {
    category: { _id: category._id, name: category.name, slug: category.slug },
    brands: brands.map((brand) => ({
      _id: brand._id,
      name: brand.name,
      slug: brand.slug,
      productCount: brand.productCount,
    })),
    priceRange,
    specifications,
    variantAxes: variantAxesView.variants.map((axis) => ({
      name: axis.name,
      code: axis.code,
      type: axis.type,
      options: axis.options ?? [],
    })),
  };
}

// FR-CAT-046's boolean toggle. Deactivating never touches, checks, or
// bypasses the FR-CAT-019 delete guard below — that guard only ever counts
// products/subcategories, never looks at status — so a category with
// products can be freely deactivated (hidden from listCategoriesForPublic
// immediately) without needing to satisfy the guard first (FR-CAT-048).
export async function updateCategoryStatus(
  id: Types.ObjectId,
  status: boolean,
  userId: string,
): Promise<CategoryRecord> {
  const updated = await updateById(id, { status, updatedBy: new Types.ObjectId(userId) });
  if (!updated) throw notFound(id);
  return updated;
}

// Cascades to the category's specification document (FR-CAT-019, #29) and
// its variant-type document (#30).
export async function deleteCategory(id: Types.ObjectId): Promise<void> {
  const [productCount, subcategoryCount] = await Promise.all([
    countByCategory(id),
    countByParent(id),
  ]);

  if (productCount > 0 || subcategoryCount > 0) {
    const reasons: string[] = [];
    if (productCount > 0) reasons.push(`${productCount} product(s)`);
    if (subcategoryCount > 0) reasons.push(`${subcategoryCount} subcategory(ies)`);
    throw new AppError(
      409,
      "CATEGORY_IN_USE",
      `Cannot delete category: referenced by ${reasons.join(" and ")}.`,
    );
  }

  // Safe without an additional guard here — productCount === 0 above
  // already guarantees no product references any field in this category's
  // spec schema, so there's nothing left to protect. The variant-type
  // document needs no such guarantee at all (FR-CAT-037: never enforced
  // against stored variant attributes), but is cascaded here too so no
  // orphaned document is left behind once the category itself is gone.
  await deleteSpecificationsForCategory(id);
  await deleteVariantsForCategory(id);
  await deleteById(id);
}
