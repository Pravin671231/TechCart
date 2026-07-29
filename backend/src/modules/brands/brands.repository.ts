import type { Types } from "mongoose";
import { Brand, type BrandDocument, type BrandLogo } from "./brands.model";

export type BrandRecord = BrandDocument & { _id: Types.ObjectId };

export type CreateBrandDoc = {
  name: string;
  slug: string;
  logo?: BrandLogo;
  description?: string;
};

export type UpdateBrandDoc = Partial<CreateBrandDoc>;

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

export async function updateById(
  id: Types.ObjectId,
  patch: UpdateBrandDoc,
): Promise<BrandRecord | null> {
  return Brand.findByIdAndUpdate(id, patch, { new: true }).lean();
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
