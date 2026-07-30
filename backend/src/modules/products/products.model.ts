import { Schema, model, type Types } from "mongoose";

// Partial stub: only the fields brands (#27) needs to count and guard against.
// The full product schema (name, slug, sku, images, specifications, variants,
// pricing, ...) lands in #31 — extend this schema then, don't replace it.
export type ProductStatus = "draft" | "published" | "archived";

export type ProductSpecificationValue = {
  name: string;
  value: string | number | boolean;
};

export type ProductSpecificationGroup = {
  groupName: string;
  values: ProductSpecificationValue[];
};

export type ProductDocument = {
  brand: Types.ObjectId;
  category: Types.ObjectId;
  status: ProductStatus;
  specifications: ProductSpecificationGroup[];
};

const productSpecificationValueSchema = new Schema<ProductSpecificationValue>(
  { name: { type: String, required: true }, value: { type: Schema.Types.Mixed, required: true } },
  { _id: false },
);

const productSpecificationGroupSchema = new Schema<ProductSpecificationGroup>(
  {
    groupName: { type: String, required: true },
    values: { type: [productSpecificationValueSchema], required: true },
  },
  { _id: false },
);

const productSchema = new Schema<ProductDocument>(
  {
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    // Validated against the owning category's categorySpecifications schema
    // (FR-CAT-032) — that validation itself lands in #31, this stub only
    // needs the storage shape so #29's delete guard has something to query.
    specifications: { type: [productSpecificationGroupSchema], default: [] },
  },
  { timestamps: true },
);

productSchema.index({ brand: 1 });
productSchema.index({ category: 1 });

export const Product = model<ProductDocument>("Product", productSchema);
