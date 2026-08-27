import type { Request } from "express";
import { Types } from "mongoose";
import { hashPassword, verifyPassword } from "@/lib/password";
import { extractSessionToken, revokeAllSessionsForUser, verifySessionToken } from "@/lib/session";
import { AppError } from "@/utils/AppError";
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
// *other* session for this admin, leaving the device making this request
// signed in. Issue #259/M3.21 — verifies/writes `users.passwordHash`
// (bcrypt) directly on the custom session engine, replacing the Better Auth
// `auth.api.changePassword` call (which no longer has a session to resolve).
// The current session is excluded from the bulk revoke by its exact `jti`,
// resolved from this request's own bearer token / session cookie. A wrong
// current password is rejected with one generic code, no further detail —
// same enumeration-safety posture as sign-in's INVALID_EMAIL_OR_PASSWORD.
export async function changePassword(
  req: Request,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const objectId = new Types.ObjectId(userId);
  const currentHash = await accountRepository.getPasswordHash(objectId);
  if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  await accountRepository.setPasswordHash(objectId, await hashPassword(newPassword));

  const token = extractSessionToken(req);
  const verified = token ? await verifySessionToken(token) : null;
  const currentJti = verified && verified.ok ? verified.jti : undefined;
  await revokeAllSessionsForUser(userId, currentJti);
}
