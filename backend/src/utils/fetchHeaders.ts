import type { Request } from "express";

// Converts Express's incoming request headers into a Fetch-API Headers
// object — Better Auth's server-side API (auth.handler, auth.api.getSession,
// ...) speaks the Fetch API throughout, not Express's own header shape.
// Extracted from betterAuthHandler.ts's original inline loop on its second
// use (requireRole.ts), matching this codebase's established "extract on
// second use" convention (buildPublicUrl, parseObjectId, truncate, ...).
export function buildFetchHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}
