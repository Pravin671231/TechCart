import { z } from "zod";
import type { FieldPath } from "react-hook-form";
import type { CategorySchema, StepId } from "@/features/product-catalog/product-form/types";

const imageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string().optional(),
  isPrimary: z.boolean(),
});

// Plain z.number() everywhere here, not z.coerce.number() — every numeric
// input is registered with RHF's `valueAsNumber: true`, which already
// converts the DOM string before validation runs. z.coerce's *input* type is
// `unknown`, which would make z.input<schema> (the type useForm is keyed to)
// disagree with the number-typed fields we actually register.
const variantRowSchema = z.object({
  id: z.string(),
  attributes: z.record(z.string(), z.string()),
  sku: z.string().min(1, "SKU is required"),
  mrp: z.number().int().positive("MRP must be greater than 0"),
  discount: z.number().int().min(0).max(99, "Discount must be 0-99"),
  stock: z.number().int().min(0, "Stock must be 0 or more"),
  weight: z.number().optional(),
  active: z.boolean(),
  // Variant images are optional, but if present are bounded to 1-2 (FR-CAT-083).
  images: z.array(imageSchema).max(2, "At most 2 images allowed"),
});

function buildSpecsSchema(schema: CategorySchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const group of schema.specGroups) {
    for (const field of group.fields) {
      let fieldSchema: z.ZodTypeAny;
      if (field.type === "number") {
        fieldSchema = z.number({ message: `${field.name} must be a number` });
      } else if (field.type === "boolean") {
        fieldSchema = z.boolean();
      } else if (field.type === "enum") {
        fieldSchema = z.enum(field.options as [string, ...string[]]);
      } else {
        fieldSchema = z.string();
      }
      if (!field.required) {
        fieldSchema =
          field.type === "boolean" ? fieldSchema : fieldSchema.optional().or(z.literal(""));
      } else if (field.type === "text") {
        fieldSchema = (fieldSchema as z.ZodString).min(1, `${field.name} is required`);
      }
      shape[field.name] = fieldSchema;
    }
  }
  return z.object(shape);
}

// Specs/variant axes come from whichever category is selected — currently just
// the one mocked category (FR-CAT-033/FR-CAT-038), so the schema is built from
// it rather than declared statically.
export function buildProductFormSchema(schema: CategorySchema) {
  return z.object({
    info: z.object({
      name: z.string().min(1, "Name is required"),
      sku: z.string().min(1, "SKU is required"),
      brand: z.string().min(1, "Brand is required"),
      category: z.string().min(1, "Category is required"),
      isFeatured: z.boolean(),
      description: z.string().min(1, "Description is required"),
    }),
    media: z.object({
      images: z
        .array(imageSchema)
        .min(1, "At least 1 image is required")
        .max(8, "At most 8 images allowed")
        .refine(
          (images) => images.filter((image) => image.isPrimary).length === 1,
          "Exactly one image must be marked primary",
        ),
    }),
    pricing: z.object({
      mrp: z.number().int().positive("MRP must be greater than 0"),
      discount: z.number().int().min(0).max(99, "Discount must be 0-99"),
      stock: z.number().int().min(0, "Stock must be 0 or more"),
      lowStockThreshold: z.number().int().min(0, "Must be 0 or more"),
    }),
    specs: buildSpecsSchema(schema),
    variants: z.object({ rows: z.array(variantRowSchema) }).superRefine((val, ctx) => {
      const seen = new Set<string>();
      val.rows.forEach((row, index) => {
        const signature = Object.entries(row.attributes)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => `${key}=${value}`)
          .join(" and ");
        if (seen.has(signature)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rows", index],
            message: `A variant with ${signature} already exists on this product.`,
          });
        }
        seen.add(signature);
      });
    }),
    seo: z.object({
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
    }),
  });
}

export type ProductFormValues = z.infer<ReturnType<typeof buildProductFormSchema>>;

export const stepFieldNames: Record<StepId, FieldPath<ProductFormValues>[]> = {
  info: ["info.name", "info.sku", "info.brand", "info.category", "info.description"],
  media: ["media.images"],
  pricing: ["pricing.mrp", "pricing.discount", "pricing.stock", "pricing.lowStockThreshold"],
  specs: ["specs"],
  variants: ["variants.rows"],
  seo: [],
};

export function buildDefaultValues(schema: CategorySchema): ProductFormValues {
  const specs: Record<string, string | boolean> = {};
  for (const group of schema.specGroups) {
    for (const field of group.fields) {
      specs[field.name] = field.type === "boolean" ? false : "";
    }
  }

  return {
    info: { name: "", sku: "", brand: "", category: schema.id, isFeatured: false, description: "" },
    media: { images: [] },
    pricing: { mrp: 0, discount: 0, stock: 0, lowStockThreshold: 0 },
    specs,
    variants: { rows: [] },
    seo: { metaTitle: "", metaDescription: "" },
  };
}
