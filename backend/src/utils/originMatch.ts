// A CORS_ORIGINS entry may contain a `*` wildcard segment (e.g.
// "https://tech-cart-buyer-app-*.vercel.app") to match Vercel's per-branch
// preview URLs, which change on every deploy and can't be listed as static
// literals. Deliberately scoped per-project (never a bare "*.vercel.app",
// which would trust every Vercel-hosted app on the internet) — the operator
// supplies the exact pattern via CORS_ORIGINS, this just matches it.
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("*")
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((pattern) =>
    pattern.includes("*") ? patternToRegExp(pattern).test(origin) : pattern === origin,
  );
}
