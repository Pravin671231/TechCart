import type { Request } from "express";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { AppError } from "@/utils/AppError";
import { buildFetchHeaders } from "@/utils/fetchHeaders";
import * as accountRepository from "./account.repository";
import type { UserProfileRecord } from "./account.repository";

// FR-AUTH-036: never actually missing once rbac(["buyer"]) has resolved a
// real session for this userId, but repository reads are still nullable at
// the type level — same defensive shape as adminUsers.service.ts's own
// getAdminUserById.
export async function getProfile(userId: string): Promise<UserProfileRecord> {
  const record = await accountRepository.findById(new Types.ObjectId(userId));
  if (!record) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }
  return record;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
}

// FR-AUTH-037: name/phone only — email is out of scope for this version,
// buyers have no password to change here.
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfileRecord> {
  const updated = await accountRepository.updateProfile(new Types.ObjectId(userId), input);
  if (!updated) {
    throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account not found.");
  }
  return updated;
}

// FR-AUTH-038/039: current-password-required change that invalidates every
// *other* session for this admin, leaving the one making this request
// intact. `revokeOtherSessions` is Better Auth's own documented option on
// changePassword — unverified against this repo's installed version until a
// real CI run confirms it (same category of risk as
// auth.api.requestPasswordReset's real name/shape, discovered the same way
// in #141). A wrong current password is rejected with one generic code, no
// further detail — same enumeration-safety posture as sign-in's
// INVALID_EMAIL_OR_PASSWORD (auth.ts).
export async function changePassword(
  req: Request,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: buildFetchHeaders(req),
    });
  } catch {
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }
}
