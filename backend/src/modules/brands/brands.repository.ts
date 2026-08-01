import type { Types } from "mongoose";
import { Brand, type BrandDocument, type BrandLogo } from "./brands.model";

export type BrandRecord = BrandDocument & { _id: Types.ObjectId };

export type CreateBrandDoc = {
  name: string;
  slug: string;
  logo?: BrandLogo;
  description?: string;
};

// status isn't part of CreateBrandDoc — a brand is always created active
// (FR-CAT-047's toggle is a dedicated PATCH .../status path, #33, not
// something set at create time).
export type UpdateBrandDoc = Partial<CreateBrandDoc> & { status?: boolean };

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

export async function list(): Promise<BrandRecord[]> {
  return Brand.find().lean();
}

export async function listActive(): Promise<BrandRecord[]> {
  return Brand.find({ status: true }).lean();
}
