export type VariantAxisType = "text" | "select" | "color" | "number";

export interface VariantAxisOption {
  label: string;
  value: string;
}

export interface VariantAxis {
  name: string;
  code: string;
  type: VariantAxisType;
  required: boolean;
  options?: VariantAxisOption[];
}

export interface CategoryVariantsView {
  category: string;
  variants: VariantAxis[];
}

// Mirrors backend's VariantAxisPatchOperation exactly
// (categoryVariants.service.ts) — matched by `code`, not `name` (safe: this
// definition drives admin form rendering only, never enforced against
// stored variant attributes, per FR-CAT-037). PATCH only ever targets an
// axis that already exists; new axes are added via the PUT (full replace)
// flow instead.
export type VariantAxisPatchOperation =
  { op: "updateAxis"; code: string; axis: VariantAxis } | { op: "deleteAxis"; code: string };
