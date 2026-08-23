// Raw MongoDB driver against the `users` collection, not a new Mongoose
// model — matches auth.ts's own explicit reasoning ("shouldn't create a
// circular import with a future users Mongoose model") and avoids two
// independent schemas (a Mongoose one here, Better Auth's own adapter)
// drifting against the same collection.
import mongoose, { Types } from "mongoose";
import type { AdminRole } from "@/scripts/seed/createAdminUser";

export type AdminUserRecord = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  status: boolean;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

function usersCollection() {
  return mongoose.connection.db!.collection<AdminUserRecord>("users");
}

const ADMIN_ROLES = ["catalog-manager", "order-manager", "super-admin"] as const;

// Only ever lists/manages non-buyer accounts — this module is the admin
// roster, not a general user directory.
const NON_BUYER_FILTER = { role: { $in: ADMIN_ROLES } };

export type AdminUserListSort = { field: string; order: 1 | -1 };
export type AdminUserListPage = { page: number; limit: number };

export async function list(
  filter: Record<string, unknown>,
  sort: AdminUserListSort | undefined,
  page: AdminUserListPage,
): Promise<{ items: AdminUserRecord[]; total: number }> {
  const mergedFilter = { ...filter, ...NON_BUYER_FILTER };
  const skip = (page.page - 1) * page.limit;
  const cursor = usersCollection()
    .find(mergedFilter)
    .skip(skip)
    .limit(page.limit);
  if (sort) cursor.sort({ [sort.field]: sort.order });

  const [items, total] = await Promise.all([
    cursor.toArray(),
    usersCollection().countDocuments(mergedFilter),
  ]);
  return { items, total };
}

export async function findById(id: Types.ObjectId): Promise<AdminUserRecord | null> {
  const record = await usersCollection().findOne({ _id: id, ...NON_BUYER_FILTER });
  return record;
}

export async function findByEmail(email: string): Promise<AdminUserRecord | null> {
  const record = await usersCollection().findOne({ email, ...NON_BUYER_FILTER });
  return record;
}

export async function updateById(
  id: Types.ObjectId,
  patch: { role?: AdminRole; status?: boolean },
): Promise<AdminUserRecord | null> {
  await usersCollection().updateOne({ _id: id }, { $set: patch });
  return findById(id);
}
