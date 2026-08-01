import { Schema, model, type Types } from "mongoose";

export type BrandLogo = {
  url: string;
  alt?: string;
};

export type BrandDocument = {
  name: string;
  slug: string;
  logo?: BrandLogo;
  description?: string;
  status: boolean;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
};

// No isPrimary here, unlike the product-image subdocument: a single logo has
// nothing to be "primary" among (FR-CAT-084 is scoped to image arrays).
const brandLogoSchema = new Schema<BrandLogo>(
  {
    url: { type: String, required: true },
    alt: { type: String },
  },
  { _id: false },
);

const brandSchema = new Schema<BrandDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    logo: { type: brandLogoSchema },
    description: { type: String },
    status: { type: Boolean, required: true, default: true },
    // Reserved for v0.3 auth (FR-CAT-013) — no admin identity to attribute yet.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Brand = model<BrandDocument>("Brand", brandSchema);
