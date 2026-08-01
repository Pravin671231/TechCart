import { Schema, model, type Types } from "mongoose";

export type CategoryImage = {
  url: string;
  alt?: string;
};

export type CategoryDocument = {
  name: string;
  slug: string;
  parentCategory?: Types.ObjectId | null;
  image?: CategoryImage;
  description?: string;
  sortOrder: number;
  status: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
};

// Same shape as the brand logo subdocument — no isPrimary, a single image
// has nothing to be "primary" among.
const categoryImageSchema = new Schema<CategoryImage>(
  {
    url: { type: String, required: true },
    alt: { type: String },
  },
  { _id: false },
);

const categorySchema = new Schema<CategoryDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    // One level maximum (FR-CAT-014) — enforced in categories.service.ts,
    // not at the schema level; Mongoose can't express "my parent must not
    // itself have a parent."
    parentCategory: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    image: { type: categoryImageSchema },
    // Not in the SRS's own categories schema table — added so metaDescription
    // (FR-CAT-022) has something to truncate from, matching FR-CAT-012's
    // fallback behaviour, which the issue's test criteria requires to work.
    description: { type: String },
    sortOrder: { type: Number, required: true, default: 0 },
    status: { type: Boolean, required: true, default: true },
    metaTitle: { type: String },
    metaDescription: { type: String },
    // Reserved for v0.3 auth (FR-CAT-013) — no admin identity to attribute yet.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Category = model<CategoryDocument>("Category", categorySchema);
