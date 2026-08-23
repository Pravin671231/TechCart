import type { Request, Response } from "express";
import { z } from "zod";
import { successResponse } from "@/utils/apiResponse";
import { parseObjectId } from "@/utils/objectId";
import { parseQuery } from "@/utils/parseQuery";
import { requireActorId } from "@/utils/actor";
import {
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
} from "./adminUsers.service";

const ADMIN_ROLES = ["catalog-manager", "order-manager", "super-admin"] as const;

export const ADMIN_USER_SORT_FIELDS = ["name", "email", "createdAt", "lastSignInAt"] as const;
type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];

const createAdminUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ADMIN_ROLES),
});

const updateAdminUserSchema = z.object({
  role: z.enum(ADMIN_ROLES).optional(),
  status: z.boolean().optional(),
});

const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(ADMIN_USER_SORT_FIELDS).optional(),
  orderBy: z.enum(["asc", "desc", "none"]).optional().default("none"),
  search: z.string().min(1).optional(),
  role: z.enum(ADMIN_ROLES).optional(),
  status: z.coerce.boolean().optional(),
});

export async function createAdminUserHandler(req: Request, res: Response): Promise<void> {
  const input = createAdminUserSchema.parse(req.body);
  const admin = await createAdminUser(input);
  res.status(201).json(successResponse(admin));
}

export async function listAdminUsersHandler(req: Request, res: Response): Promise<void> {
  const query = listAdminUsersQuerySchema.parse(req.query);
  const { filter, sort, page, limit } = parseQuery<AdminUserSortField>(
    query.search ? { value: query.search, fields: ["name", "email"] } : undefined,
    { page: query.page, limit: query.limit },
    query.sortBy,
    query.orderBy,
    ADMIN_USER_SORT_FIELDS,
    {
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    },
  );
  const { items, pagination } = await listAdminUsers(filter, sort, { page, limit });
  res.status(200).json(successResponse(items, pagination));
}

export async function updateAdminUserHandler(req: Request, res: Response): Promise<void> {
  const id = parseObjectId(req.params.id);
  const input = updateAdminUserSchema.parse(req.body);
  const admin = await updateAdminUser(id, input, requireActorId(req));
  res.status(200).json(successResponse(admin));
}
