import mongoose from "mongoose";

// Extracted on its second use (Issue #142) from src/lib/auth.ts's
// revokeSessionsAfterPasswordReset (#141) — matches both a plain string and
// an ObjectId-typed userId, since a string-only match against `session`'s
// own userId field found zero documents in real CI even when this exact
// logic was confirmed running (see auth.ts's own comment on this).
//
// `excludeToken` (Issue #144/M3.6) keeps one specific session alive — the
// one making the request, for admin change-password's "every *other*
// session" requirement (FR-AUTH-039). Added instead of relying on Better
// Auth's own changePassword `revokeOtherSessions` option: a real CI run
// showed that option kills the *current* session's token too, not just the
// others, so account.service.ts's changePassword calls this directly
// afterward with the token off the request's own Authorization header.
export async function revokeSessionsForUser(userId: string, excludeToken?: string): Promise<void> {
  const userIdVariants: unknown[] = [userId];
  if (mongoose.isValidObjectId(userId)) {
    userIdVariants.push(new mongoose.Types.ObjectId(userId));
  }
  const filter: Record<string, unknown> = { userId: { $in: userIdVariants } };
  if (excludeToken) {
    filter.token = { $ne: excludeToken };
  }
  await mongoose.connection.db!.collection("session").deleteMany(filter);
}
