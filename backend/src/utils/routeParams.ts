import { AppError } from "./AppError";

// First buyer-facing ":slug" routes (#35) — same "validate the param shape
// before it reaches the service" reasoning as objectId.ts's parseObjectId,
// and the same req.params.slug real type, string | string[] | undefined
// (ParamsDictionary's index signature under noUncheckedIndexedAccess: true).
// A malformed/missing slug is a 400, not a 404 — 404 is reserved for a
// well-formed slug that just doesn't match any record.
export function parseSlugParam(slug: string | string[] | undefined): string {
  if (typeof slug !== "string" || slug.length === 0) {
    throw new AppError(400, "INVALID_SLUG", `"${String(slug)}" is not a valid slug.`);
  }
  return slug;
}
