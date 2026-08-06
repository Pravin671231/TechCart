export type SpecificationValues = Record<string, string | number | boolean>;

export function specKey(groupName: string, fieldName: string): string {
  return `${groupName}::${fieldName}`;
}
