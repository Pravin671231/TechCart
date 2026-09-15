import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseQuery } from "@/utils/parseQuery";
import { getUserDirectoryEntry, listUserDirectory } from "./userDirectory.service";

const ALL_ROLES = ["buyer", "catalog-manager", "order-manager", "super-admin"] as const;

export const USER_DIRECTORY_SORT_FIELDS = ["name", "email", "createdAt", "lastSignInAt"] as const;
type UserDirectorySortField = (typeof USER_DIRECTORY_SORT_FIELDS)[number];

const listUserDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(USER_DIRECTORY_SORT_FIELDS).optional(),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("none"),
  search: z.string().min(1).optional(),
  role: z.enum(ALL_ROLES).optional(),
  status: z.coerce.boolean().optional(),
});

// FR-AUTH-047–049: read-only — a single GET handler, no create/update/delete.
export async function listUserDirectoryHandler(req: Request, res: Response): Promise<void> {
  const query = listUserDirectoryQuerySchema.parse(req.query);
  const { filter, sort, page, limit } = parseQuery<UserDirectorySortField>(
    query.search ? { value: query.search, fields: ["name", "email"] } : undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    USER_DIRECTORY_SORT_FIELDS,
    {
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    },
  );
  const { items, pagination } = await listUserDirectory(filter, sort, { page, limit });
  res.status(200).json(successResponse(items, pagination));
}

// FR-AUTH-050 — single directory entry by id, same read-only contract.
export async function getUserDirectoryEntryHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const entry = await getUserDirectoryEntry(id);
  res.status(200).json(successResponse(entry));
}
