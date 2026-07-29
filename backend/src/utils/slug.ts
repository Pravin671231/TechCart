export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Appends a numeric suffix (-2, -3, ...) until `slugExists` reports the
 * candidate is free. `slugExists` is injected rather than querying Mongoose
 * directly so this stays DB-agnostic and reusable by categories/products.
 */
export async function generateUniqueSlug(
  name: string,
  slugExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;

  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}
