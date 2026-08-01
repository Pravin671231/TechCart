// Reusable by products (#31), which needs the identical FR-CAT-012
// meta-description fallback. 160 chars matches the conventional SEO
// meta-description length — no numeric bound is specified in the SRS.
export function truncate(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;

  const sliced = text.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;

  return `${cut.trimEnd()}...`;
}

// Reusable by every admin list search (categories, brands, products —
// FR-CAT-050–052): user-submitted search text is interpolated into a Mongo
// regex, so any regex metacharacter in it (e.g. a literal ".") must be
// escaped first or it would be interpreted as a pattern rather than matched
// literally.
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
