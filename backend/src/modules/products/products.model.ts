import { Schema, model, type Types } from "mongoose";

export type ProductStatus = "draft" | "published" | "archived";

export type ProductImage = {
  url: string;
  alt?: string;
  isPrimary: boolean;
};

export type ProductSpecificationValue = {
  name: string;
  value: string | number | boolean;
};

export type ProductSpecificationGroup = {
  groupName: string;
  values: ProductSpecificationValue[];
};

// Partial stub: only `sku` exists so far, just enough to establish the
// unique multikey index FR-CAT-003's SKU cross-check needs (#31's own task
// list calls this out explicitly, ahead of any variant-creation endpoint).
// The full variant subdocument (attributes, images, mrp/discount/sellingPrice,
// stock, weight, active) lands in #32 — extend this, don't replace it.
// Unlike every other subdocument in this schema, this one keeps Mongoose's
// default auto-generated `_id` (no `{ _id: false }`), matching the SRS's own
// variant shape table, which lists `_id` as a field.
export type ProductVariantStub = {
  sku: string;
};

export type ProductDocument = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  images: ProductImage[];
  specifications: ProductSpecificationGroup[];
  variants: ProductVariantStub[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  isFeatured: boolean;
  status: ProductStatus;
  metaTitle?: string;
  metaDescription?: string;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
};

// Same shape as brand/category images plus isPrimary (FR-CAT-084) — unlike
// those single-image fields, a product carries an array where exactly one
// entry is primary.
const productImageSchema = new Schema<ProductImage>(
  {
    url: { type: String, required: true },
    alt: { type: String },
    isPrimary: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

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

const productVariantStubSchema = new Schema<ProductVariantStub>({
  sku: { type: String, required: true },
});

// Structural bounds (mrp > 0, discount 0-99, images 1-8, specifications
// matching the category's schema) live in products.controller.ts (Zod) and
// products.service.ts (schema-validation and image-count checks needing
// external state), not here — no custom Mongoose validators, same split
// every prior catalog module uses.
const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    images: { type: [productImageSchema], required: true, default: [] },
    // Validated against the owning category's categorySpecifications schema
    // (FR-CAT-032/034) in products.service.ts.
    specifications: { type: [productSpecificationGroupSchema], default: [] },
    variants: { type: [productVariantStubSchema], default: [] },
    mrp: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true },
    stock: { type: Number, required: true },
    lowStockThreshold: { type: Number, required: true, default: 0 },
    isFeatured: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      required: true,
      default: "draft",
    },
    metaTitle: { type: String },
    metaDescription: { type: String },
    // Reserved for v0.3 auth (FR-CAT-013) — no admin identity to attribute yet.
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

productSchema.index({ brand: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
// A unique multikey index — MongoDB indexes each array element separately, so
// this enforces uniqueness across every product's variants.sku individually.
// An empty variants array (every product's state until #32 lands) contributes
// no index entries at all, so this is safe to declare now.
productSchema.index({ "variants.sku": 1 }, { unique: true });

export const Product = model<ProductDocument>("Product", productSchema);
