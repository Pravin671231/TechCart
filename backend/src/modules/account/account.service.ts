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
// signed in. The bearer token a client sends is `<rawToken>.<signature>`
// (bearer plugin), but the `session` collection only ever stores the raw
// part before that `.` — confirmed via real CI diagnostics, after every
// naive attempt to exclude "the current session" by matching the full
// header value against `session.token` silently matched nothing and ended
// up deleting every session for the user, current one included. Every
// comparison below uses that raw first segment instead. A wrong current
// password is rejected with one generic code, no further detail — same
// enumeration-safety posture as sign-in's INVALID_EMAIL_OR_PASSWORD
// (auth.ts).
export async function changePassword(
  req: Request,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const currentToken = bearerToken?.split(".")[0];

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: buildFetchHeaders(req),
    });
  } catch {
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  await revokeSessionsForUser(userId, currentToken);
}
