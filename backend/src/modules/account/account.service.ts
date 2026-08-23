import type { Request } from "express";
import { Types } from "mongoose";
import { auth } from "@/lib/auth";
import { AppError } from "@/utils/AppError";
import { buildFetchHeaders } from "@/utils/fetchHeaders";
import { revokeSessionsForUser } from "@/utils/sessions";
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
// signed in. Two things were tried and ruled out by real CI runs before
// this shape: (1) Better Auth's own changePassword `revokeOtherSessions`
// option kills the *current* session's token too, not just the others; (2)
// excluding the pre-change request's own bearer token from a manual
// revokeSessionsForUser call still failed identically — because Better Auth
// *rotates* the current session's token as part of changing the password
// (a new token value, same session), so the old pre-change token no longer
// matches anything by the time it's excluded against.
//
// The fix: call changePassword with `asResponse: true` (the same "get the
// real Web Response back" pattern betterAuthHandler.ts already uses for
// every /api/auth/* route) to read the *new* rotated token off the
// response's `set-auth-token` header (the bearer plugin sets this on every
// session-establishing/rotating response, confirmed working end-to-end for
// sign-in in #139/#140), exclude sessions by that new token instead of the
// stale old one, and return it to the caller so the client can update its
// stored credential and stay signed in. A wrong current password comes back
// as a non-ok Response (no session to rotate), rejected with one generic
// code — same enumeration-safety posture as sign-in's
// INVALID_EMAIL_OR_PASSWORD (auth.ts).
export async function changePassword(
  req: Request,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<string | undefined> {
  const response = await auth.api.changePassword({
    body: { currentPassword, newPassword },
    headers: buildFetchHeaders(req),
    asResponse: true,
  });

  if (!response.ok) {
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  const newToken = response.headers.get("set-auth-token") ?? undefined;
  await revokeSessionsForUser(userId, newToken);
  return newToken;
}
