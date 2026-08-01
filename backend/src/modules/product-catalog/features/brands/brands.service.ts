import type { Types } from "mongoose";
import { AppError } from "@/utils/AppError";
import { generateUniqueSlug } from "@/utils/slug";
import { consumeImageKeys, buildPublicUrl } from "@/modules/uploads/uploads.service";
import { countByBrand, countByBrandIds } from "@/modules/products/products.repository";
import type { BrandLogo } from "./brands.model";
import {
  create,
  findById,
  slugExists,
  updateById,
  deleteById,
  list,
  listActive,
  type BrandRecord,
  type CreateBrandDoc,
  type UpdateBrandDoc,
} from "./brands.repository";

// Optional fields spell out `| undefined` explicitly (not just `?:`) because
// these types accept a parsed Zod object as input: with
// `exactOptionalPropertyTypes: true`, Zod's `.optional()` output type is
// `T | undefined`, which is a different (wider) type than a bare `key?: T`.
export type CreateBrandInput = {
  name: string;
  description?: string | undefined;
  logo?: { objectKey: string; alt?: string | undefined } | undefined;
};

export type UpdateBrandInput = {
  name?: string | undefined;
  description?: string | undefined;
  logo?: { objectKey: string; alt?: string | undefined } | undefined;
};

export type BrandListItem = BrandRecord & { productCount: number };

export type PublicBrand = Pick<BrandRecord, "_id" | "name" | "slug"> &
  Partial<Pick<BrandRecord, "logo" | "description">>;

function notFound(id: Types.ObjectId): AppError {
  return new AppError(404, "BRAND_NOT_FOUND", `Brand ${id.toString()} was not found.`);
}

// Verifies the key was actually presigned (FR-CAT-082) and turns it into the
// stored subdocument. Shared by create and update — a logo swap on update
// re-consumes the new key exactly like a fresh create does.
async function resolveLogo(logo: {
  objectKey: string;
  alt?: string | undefined;
}): Promise<BrandLogo> {
  await consumeImageKeys([logo.objectKey]);
  const url = buildPublicUrl(logo.objectKey);
  return logo.alt !== undefined ? { url, alt: logo.alt } : { url };
}

export async function createBrand(input: CreateBrandInput): Promise<BrandRecord> {
  const slug = await generateUniqueSlug(input.name, slugExists);

  const doc: CreateBrandDoc = { name: input.name, slug };
  if (input.description !== undefined) doc.description = input.description;
  if (input.logo) doc.logo = await resolveLogo(input.logo);

  return create(doc);
}

// Slug is deliberately never touched here — FR-CAT-025 only lists
// name/logo/description as updatable, and the slug stays a stable identifier
// once assigned so existing URLs don't break.
export async function updateBrand(
  id: Types.ObjectId,
  input: UpdateBrandInput,
): Promise<BrandRecord> {
  const patch: UpdateBrandDoc = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.logo !== undefined) patch.logo = await resolveLogo(input.logo);

  const updated = await updateById(id, patch);
  if (!updated) throw notFound(id);
  return updated;
}

export async function getBrandById(id: Types.ObjectId): Promise<BrandRecord> {
  const brand = await findById(id);
  if (!brand) throw notFound(id);
  return brand;
}

export async function listBrandsForAdmin(search?: string): Promise<BrandListItem[]> {
  const brands = await list(search);
  const counts = await countByBrandIds(brands.map((brand) => brand._id));

  return brands.map((brand) => ({
    ...brand,
    productCount: counts.get(brand._id.toString()) ?? 0,
  }));
}

export async function listBrandsForPublic(): Promise<PublicBrand[]> {
  const brands = await listActive();

  return brands.map((brand) => {
    const publicBrand: PublicBrand = { _id: brand._id, name: brand.name, slug: brand.slug };
    if (brand.logo) publicBrand.logo = brand.logo;
    if (brand.description !== undefined) publicBrand.description = brand.description;
    return publicBrand;
  });
}

// FR-CAT-047's boolean toggle. Deactivating never touches, checks, or
// bypasses the delete guard below (FR-CAT-028) — that guard only ever counts
// products, never looks at status — so a brand with products can be freely
// deactivated (hidden from listBrandsForPublic immediately) without needing
// to satisfy the guard first (FR-CAT-048).
export async function updateBrandStatus(id: Types.ObjectId, status: boolean): Promise<BrandRecord> {
  const updated = await updateById(id, { status });
  if (!updated) throw notFound(id);
  return updated;
}

// TOCTOU note: a product could be created between this count and the delete
// below. No transactions exist anywhere in this codebase yet (categories'
// FR-CAT-019 guard will have the identical gap) — accepted, not fixed here.
export async function deleteBrand(id: Types.ObjectId): Promise<void> {
  const count = await countByBrand(id);
  if (count > 0) {
    throw new AppError(
      409,
      "BRAND_IN_USE",
      `Cannot delete brand: referenced by ${count} product(s).`,
    );
  }
  await deleteById(id);
}
