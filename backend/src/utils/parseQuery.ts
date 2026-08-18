import { escapeRegExp } from "./text";

export interface SearchOption {
  value?: string;
  fields: readonly string[];
}

export interface PaginationOption {
  page: number;
  limit: number;
}

export type OrderBy = "asc" | "desc" | "none";

export interface ParsedSort<TField extends string> {
  field: TField;
  order: 1 | -1;
}

export interface ParsedListQuery<TField extends string> {
  filter: Record<string, unknown>;
  sort?: ParsedSort<TField>;
  page: number;
  limit: number;
}

// Pure, non-throwing (Issue #104) — page/limit/sortBy/orderBy are validated
// by the caller's own Zod schema (z.enum(field), .max(100), ...) before this
// ever runs, exactly like products' pre-#104 `sort` enum did; a ZodError is
// the only thing this codebase's errorHandler.ts translates into
// VALIDATION_ERROR's {errors} shape, so this never rejects on its own.
// `field` is consulted only as a redundant, unreachable-once-Zod-has-run
// defensive guard, and to type the returned sort.
export function parseQuery<TField extends string>(
  search: SearchOption | undefined,
  pagination: PaginationOption,
  sortBy: TField | undefined,
  orderBy: OrderBy,
  field: readonly TField[],
  filter: Record<string, unknown> = {},
): ParsedListQuery<TField> {
  const mergedFilter: Record<string, unknown> = { ...filter };
  if (search?.value) {
    const escaped = escapeRegExp(search.value);
    mergedFilter.$or = search.fields.map((name) => ({
      [name]: { $regex: escaped, $options: "i" },
    }));
  }

  const sort: ParsedSort<TField> | undefined =
    orderBy !== "none" && sortBy !== undefined && field.includes(sortBy)
      ? { field: sortBy, order: orderBy === "asc" ? 1 : -1 }
      : undefined;

  // Omit `sort` entirely rather than set it to `undefined` — exactOptionalPropertyTypes
  // (see apiResponse.ts's successResponse) treats those as different things.
  return sort
    ? { filter: mergedFilter, sort, page: pagination.page, limit: pagination.limit }
    : { filter: mergedFilter, page: pagination.page, limit: pagination.limit };
}
