export type SpecificationFieldType = "text" | "number" | "boolean" | "enum";

export interface SpecificationField {
  name: string;
  type: SpecificationFieldType;
  unit?: string;
  options?: string[];
  required: boolean;
  filterable: boolean;
}

export interface SpecificationGroup {
  groupName: string;
  specifications: SpecificationField[];
}

export interface CategorySpecificationsView {
  category: string;
  specificationGroups: SpecificationGroup[];
}

// Mirrors backend's SpecPatchOperation discriminated union exactly
// (categorySpecifications.service.ts) — PATCH only ever targets something
// that already exists; new groups/fields are added via the PUT (full
// replace) flow instead.
export type SpecPatchOperation =
  | { op: "renameGroup"; groupName: string; newGroupName: string }
  | { op: "deleteGroup"; groupName: string }
  | { op: "updateField"; groupName: string; name: string; field: SpecificationField }
  | { op: "deleteField"; groupName: string; name: string };
