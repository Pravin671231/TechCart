import { Schema, model, type Types } from "mongoose";

// Single source of truth for the three states — reused by products.model.ts's
// own schema enum below and by products.controller.ts's status-update Zod
// schema (FR-CAT-045), so the two can't drift apart.
export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

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

export type ProductVariantAttribute = {
  name: string;
  value: string;
};

// Unlike every other subdocument in this schema, this one keeps Mongoose's
// default auto-generated `_id` (no `{ _id: false }`), matching the SRS's own
// variant shape table, which lists `_id` as a field — needed so a variant
// can be addressed individually via PATCH .../variants/:variantId.
//
// Every sellable, priced, imaged unit is a variant — the product itself
// carries none of `sku`/`images`/`mrp`/`discount`/`sellingPrice` (Issue #102,
// SRS v0.2 amendment, FR-CAT-001/003/004/039/043). Stock/inventory tracking
// is removed system-wide, not moved here — there is no `stock` field on
// either the product or the variant (FR-CAT-008/009/011/059/073/095/096).
export type ProductVariant = {
  _id: Types.ObjectId;
  sku: string;
  attributes: ProductVariantAttribute[];
  // Required, 1-2 images (bound enforced in products.service.ts, same split
  // as every other structural bound in this schema) — there is no parent
  // product gallery to fall back to now that the product carries no images
  // of its own (FR-CAT-064, FR-CAT-083).
  images: ProductImage[];
  mrp: number;
  discount: number;
  sellingPrice: number;
  weight?: number;
  active: boolean;
};

export type ProductDocument = {
  name: string;
  slug: string;
  description: string;
  brand: Types.ObjectId;
  category: Types.ObjectId;
  specifications: ProductSpecificationGroup[];
  variants: ProductVariant[];
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

const productVariantAttributeSchema = new Schema<ProductVariantAttribute>(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

// Structural bounds (mrp/discount rules per FR-CAT-042/085/086, the
// attribute-set duplicate guard, and the 1-2 image bound — required, not
// optional, since #102 removed the parent product's own images) live in
// products.controller.ts (Zod) and products.service.ts, same split as the
// product schema above.
const productVariantSchema = new Schema<ProductVariant>(
  {
    sku: { type: String, required: true },
    attributes: { type: [productVariantAttributeSchema], required: true },
    images: { type: [productImageSchema], required: true },
    mrp: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    sellingPrice: { type: Number, required: true },
    weight: { type: Number },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// Structural bounds (specifications matching the category's schema) live in
// products.controller.ts (Zod) and products.service.ts (schema-validation
// needing external state), not here — no custom Mongoose validators, same
// split every prior catalog module uses.
const productSchema = new Schema<ProductDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    // Validated against the owning category's categorySpecifications schema
    // (FR-CAT-032/034) in products.service.ts.
    specifications: { type: [productSpecificationGroupSchema], default: [] },
    variants: { type: [productVariantSchema], default: [] },
    isFeatured: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
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
// The sole SKU-uniqueness index now that #102 removed the product's own
// `sku` — a unique multikey index, since MongoDB indexes each array element
// separately, enforcing uniqueness across every product's variants.sku
// individually. Declared back in #31, ahead of any variant-creation endpoint
// (an empty array contributes no index entries) — now actually populated by
// #32.
productSchema.index({ "variants.sku": 1 }, { unique: true });

export const Product = model<ProductDocument>("Product", productSchema);
