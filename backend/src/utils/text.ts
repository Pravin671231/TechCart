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
