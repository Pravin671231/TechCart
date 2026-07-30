import { Schema, model, type Types } from "mongoose";

// Partial stub: only the fields brands (#27) needs to count and guard against.
// The full product schema (name, slug, sku, images, specifications, variants,
// pricing, ...) lands in #31 — extend this schema then, don't replace it.
export type ProductStatus = "draft" | "published" | "archived";

export type ProductDocument = {
  brand: Types.ObjectId;
  category: Types.ObjectId;
  status: ProductStatus;
};

const productSchema = new Schema<ProductDocument>(
  {
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
  },
  { timestamps: true },
);

productSchema.index({ brand: 1 });
productSchema.index({ category: 1 });

export const Product = model<ProductDocument>("Product", productSchema);
