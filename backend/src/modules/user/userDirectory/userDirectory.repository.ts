// Issue #385 (FR-AUTH-047–049) — the read-only, unscoped counterpart to
// adminUsers.repository.ts: lists every account (buyer + admin), not just
// the three admin roles. Never imports UserAuth.
import { User, type UserDocument } from "@/modules/user/user.model";

export type UserDirectoryRecord = Pick<
  UserDocument,
  "_id" | "name" | "email" | "role" | "status" | "isVerified" | "lastSignInAt" | "createdAt"
>;

export type UserDirectoryListSort = { field: string; order: 1 | -1 };
export type UserDirectoryListPage = { page: number; limit: number };

export async function list(
  filter: Record<string, unknown>,
  sort: UserDirectoryListSort | undefined,
  page: UserDirectoryListPage,
): Promise<{ items: UserDirectoryRecord[]; total: number }> {
  const skip = (page.page - 1) * page.limit;
  // Explicit passwordHash exclusion — see adminUsers.repository.ts's
  // identical comment; belt-and-braces ahead of the one-time migration.
  const query = User.find(filter).select("-passwordHash").skip(skip).limit(page.limit);
  if (sort) query.sort({ [sort.field]: sort.order });

  const [items, total] = await Promise.all([
    query.lean(),
    User.countDocuments(filter),
  ]);
  return { items, total };
}
