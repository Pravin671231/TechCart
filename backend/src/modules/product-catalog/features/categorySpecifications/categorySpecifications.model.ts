import { Schema, model, type Types } from "mongoose";

export type SpecificationFieldType = "text" | "number" | "boolean" | "enum";

// unit/options spell out `| undefined` explicitly (not just `?:`) because
// this type accepts a parsed Zod object as input: with
// `exactOptionalPropertyTypes: true`, Zod's `.optional()` output type is
// `T | undefined`, a different (wider) type than a bare `key?: T`.
export type SpecificationField = {
  name: string;
  type: SpecificationFieldType;
  unit?: string | undefined;
  options?: string[] | undefined;
  required: boolean;
  filterable: boolean;
};

export type SpecificationGroup = {
  groupName: string;
  specifications: SpecificationField[];
};

export type CategorySpecificationsDocument = {
  category: Types.ObjectId;
  specificationGroups: SpecificationGroup[];
};

// Structural rules (options required when type is "enum", filterable
// forbidden when type is "text", no duplicate group/field names) live in
// categorySpecifications.controller.ts (Zod) and .service.ts (name-collision
// checks needing the current document), not here — no custom Mongoose
// validators.
const specificationFieldSchema = new Schema<SpecificationField>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "boolean", "enum"], required: true },
    unit: { type: String },
    options: { type: [String] },
    required: { type: Boolean, required: true, default: false },
    filterable: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const specificationGroupSchema = new Schema<SpecificationGroup>(
  {
    groupName: { type: String, required: true },
    specifications: { type: [specificationFieldSchema], required: true, default: [] },
  },
  { _id: false },
);

const categorySpecificationsSchema = new Schema<CategorySpecificationsDocument>(
  {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, unique: true },
    specificationGroups: { type: [specificationGroupSchema], required: true, default: [] },
  },
  { timestamps: true },
);

export const CategorySpecifications = model<CategorySpecificationsDocument>(
  "CategorySpecifications",
  categorySpecificationsSchema,
);
