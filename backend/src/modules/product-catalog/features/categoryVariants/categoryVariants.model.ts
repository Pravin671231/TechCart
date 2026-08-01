import { Schema, model, type Types } from "mongoose";

export type VariantAxisType = "text" | "select" | "color" | "number";

export type VariantAxisOption = { label: string; value: string };

// options spells out `| undefined` explicitly (not just `?:`) for the same
// reason as categorySpecifications.model.ts's SpecificationField: this type
// accepts a parsed Zod object as input, and under exactOptionalPropertyTypes:
// true, Zod's `.optional()` output type is `T | undefined`, wider than a bare
// `key?: T`.
export type VariantAxis = {
  name: string;
  code: string;
  type: VariantAxisType;
  required: boolean;
  options?: VariantAxisOption[] | undefined;
};

export type CategoryVariantsDocument = {
  category: Types.ObjectId;
  variants: VariantAxis[];
};

// Structural rules (options required for select/color, forbidden for
// text/number, no duplicate axis codes) live in categoryVariants.controller.ts
// (Zod) and .service.ts (name-collision checks needing the current document),
// not here — no custom Mongoose validators, same split as categorySpecifications.
const variantAxisOptionSchema = new Schema<VariantAxisOption>(
  {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const variantAxisSchema = new Schema<VariantAxis>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "select", "color", "number"],
      required: true,
      default: "select",
    },
    required: { type: Boolean, required: true, default: false },
    options: { type: [variantAxisOptionSchema] },
  },
  { _id: false },
);

const categoryVariantsSchema = new Schema<CategoryVariantsDocument>(
  {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, unique: true },
    variants: { type: [variantAxisSchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const CategoryVariants = model<CategoryVariantsDocument>(
  "CategoryVariants",
  categoryVariantsSchema,
);
