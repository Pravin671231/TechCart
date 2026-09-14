// Issue #385 — rewritten on the real `User` model. This file never imports
// UserAuth — the admin roster's list/create/update responses can no longer
// leak `passwordHash` even by accident, since the collection this file
// queries doesn't store one.
import type { Types } from "mongoose";
import { User, type UserDocument } from "@/modules/user/user.model";
import type { AdminRole } from "@/scripts/seed/createAdminUser";

export type AdminUserRecord = Pick<
  UserDocument,
  "_id" | "name" | "email" | "role" | "status" | "isVerified" | "lastSignInAt" | "createdAt" | "updatedAt"
>;

const ADMIN_ROLES = ["catalog-manager", "order-manager", "super-admin"] as const;

// Only ever lists/manages non-buyer accounts — this module is the admin
// roster, not a general user directory (see user/userDirectory/ for that).
const NON_BUYER_FILTER = { role: { $in: ADMIN_ROLES } };

export type AdminUserListSort = { field: string; order: 1 | -1 };
export type AdminUserListPage = { page: number; limit: number };

export async function list(
  filter: Record<string, unknown>,
  sort: AdminUserListSort | undefined,
  page: AdminUserListPage,
): Promise<{ items: AdminUserRecord[]; total: number }> {
  // NON_BUYER_FILTER spreads first so a caller-supplied `filter.role` (from
  // the controller's own z.enum(ADMIN_ROLES) — already guaranteed to be one
  // of the three admin roles) overrides the generic $in default instead of
  // being clobbered by it.
  const mergedFilter = { ...NON_BUYER_FILTER, ...filter };
  const skip = (page.page - 1) * page.limit;
  // Explicit passwordHash exclusion, belt-and-braces alongside the model
  // split itself — pre-migration documents (see
  // scripts/migrations/splitUserAuth.ts) may still physically carry a
  // legacy `passwordHash` field on `users` until that script has run against
  // this database, and it's an undeclared schema path so Mongoose wouldn't
  // otherwise strip it from a lean() read.
  const query = User.find(mergedFilter).select("-passwordHash").skip(skip).limit(page.limit);
  if (sort) query.sort({ [sort.field]: sort.order });

  const [items, total] = await Promise.all([
    query.lean(),
    User.countDocuments(mergedFilter),
  ]);
  return { items, total };
}

export async function findById(id: Types.ObjectId): Promise<AdminUserRecord | null> {
  return User.findOne({ _id: id, ...NON_BUYER_FILTER }).select("-passwordHash").lean();
}

export async function findByEmail(email: string): Promise<AdminUserRecord | null> {
  return User.findOne({ email, ...NON_BUYER_FILTER }).select("-passwordHash").lean();
}

export async function updateById(
  id: Types.ObjectId,
  patch: { role?: AdminRole; status?: boolean },
): Promise<AdminUserRecord | null> {
  await User.updateOne({ _id: id }, { $set: patch });
  return findById(id);
}
