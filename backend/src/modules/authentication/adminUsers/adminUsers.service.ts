import crypto from "node:crypto";
import type { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { AppError } from "@/utils/AppError";
import { buildPagination, type Pagination } from "@/utils/apiResponse";
import { revokeSessionsForUser } from "@/utils/sessions";
import { provisionAdminUser, type AdminRole } from "@/scripts/seed/createAdminUser";
import * as adminUsersRepository from "./adminUsers.repository";
import type {
  AdminUserListPage,
  AdminUserListSort,
  AdminUserRecord,
} from "./adminUsers.repository";

export interface CreateAdminUserInput {
  email: string;
  name: string;
  role: AdminRole;
}

// FR-AUTH-025: creates an admin of any of the three roles, reusing #140's
// provisionAdminUser() so role/twoFactorEnabled are set identically to
// every other admin account in this codebase — no separate code path for
// "created via the API" vs. "created via the seed script". The password
// itself is random and never returned/logged: immediately followed by
// #141's real requestPasswordReset flow so the new admin sets their own
// password via the emailed link before ever signing in (FR-AUTH-029 — the
// first sign-in still goes through the identical password+OTP flow, no
// bypass, since nothing here establishes a session).
export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUserRecord> {
  const temporaryPassword = crypto.randomBytes(24).toString("base64url");
  await provisionAdminUser({
    email: input.email,
    password: temporaryPassword,
    name: input.name,
    role: input.role,
  });
  await auth.api.requestPasswordReset({ body: { email: input.email } });

  const created = await adminUsersRepository.findByEmail(input.email);
  if (!created) {
    throw new AppError(500, "INTERNAL_ERROR", "Admin user was created but could not be read back.");
  }
  return created;
}

export async function listAdminUsers(
  filter: Record<string, unknown>,
  sort: AdminUserListSort | undefined,
  page: AdminUserListPage,
): Promise<{ items: AdminUserRecord[]; pagination: Pagination }> {
  const { items, total } = await adminUsersRepository.list(filter, sort, page);
  return { items, pagination: buildPagination(page.page, page.limit, total) };
}

export async function getAdminUserById(id: Types.ObjectId): Promise<AdminUserRecord> {
  const record = await adminUsersRepository.findById(id);
  if (!record) {
    throw new AppError(404, "ADMIN_USER_NOT_FOUND", "Admin user not found.");
  }
  return record;
}

export interface UpdateAdminUserInput {
  role?: AdminRole;
  status?: boolean;
}

// FR-AUTH-026/028: an admin can never modify their own account through this
// endpoint (role escalation or self-deactivation both blocked identically —
// the guard doesn't distinguish which field changed). Deactivating
// (status: false) invalidates every live session for that admin
// synchronously, in the same request, reusing #141's revokeSessionsForUser.
export async function updateAdminUser(
  id: Types.ObjectId,
  input: UpdateAdminUserInput,
  requesterId: string,
): Promise<AdminUserRecord> {
  if (id.toString() === requesterId) {
    throw new AppError(400, "CANNOT_MODIFY_OWN_ACCOUNT", "You cannot modify your own account.");
  }
  await getAdminUserById(id); // 404s if not found/not an admin account

  const updated = await adminUsersRepository.updateById(id, input);
  if (!updated) {
    throw new AppError(404, "ADMIN_USER_NOT_FOUND", "Admin user not found.");
  }

  if (input.status === false) {
    await revokeSessionsForUser(id.toString());
  }

  return updated;
}
