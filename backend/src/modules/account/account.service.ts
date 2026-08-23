import type { Request } from "express";
import mongoose, { Types } from "mongoose";
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

function sessionCollection() {
  return mongoose.connection.db!.collection("session");
}

// FR-AUTH-038/039: current-password-required change that invalidates every
// *other* session for this admin, leaving the device making this request
// signed in. Two prior shapes were tried and ruled out by real CI runs:
// Better Auth's own `revokeOtherSessions` option, and excluding the
// pre-change bearer token from a manual revokeSessionsForUser call — both
// left the *current* session dead afterward too. Neither attempt's response
// carried a `set-auth-token` header either (confirmed via both
// `auth.api.changePassword({asResponse: true})` and proxying through
// `auth.handler()` directly, the same call betterAuthHandler.ts makes for
// every /api/auth/* route) — changePassword doesn't reissue a session
// token, it just unconditionally clears every session row for the user,
// current one included.
//
// Given that, session preservation is done entirely outside of Better
// Auth's own side effects: snapshot the current session's row (matched by
// its bearer token) before calling changePassword, then — if that row is
// gone afterward — restore it verbatim. This guarantees the device making
// the change stays signed in with the exact same token regardless of what
// changePassword does internally. A wrong current password is rejected
// with one generic code, no further detail — same enumeration-safety
// posture as sign-in's INVALID_EMAIL_OR_PASSWORD (auth.ts).
export async function changePassword(
  req: Request,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const currentToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  const currentSessionDoc = currentToken
    ? await sessionCollection().findOne({ token: currentToken })
    : null;

  // TEMPORARY diagnostics (Issue #144) — three prior fix attempts all failed
  // identically in real CI with no visibility into the actual `session`
  // collection shape; this prints ground truth on the next CI run instead
  // of guessing a fourth time. Removed once the real fix is confirmed.
  console.log("[account.changePassword] diagnostics", {
    userId,
    hasAuthHeader: authHeader != null,
    currentToken,
    currentSessionDocFound: currentSessionDoc != null,
    currentSessionDoc,
    allSessionsForUserBefore: await sessionCollection().find({}).toArray(),
  });

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: buildFetchHeaders(req),
    });
  } catch (err) {
    console.log("[account.changePassword] changePassword threw", err);
    throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.");
  }

  console.log("[account.changePassword] allSessionsForUserAfterChange", {
    allSessions: await sessionCollection().find({}).toArray(),
  });

  await revokeSessionsForUser(userId, currentToken);

  if (currentSessionDoc) {
    const stillThere = await sessionCollection().findOne({ token: currentToken });
    if (!stillThere) {
      await sessionCollection().insertOne(currentSessionDoc);
    }
  }

  console.log("[account.changePassword] allSessionsForUserAfterRestore", {
    allSessions: await sessionCollection().find({}).toArray(),
  });
}
