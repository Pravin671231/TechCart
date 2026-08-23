import mongoose from "mongoose";

// Extracted on its second use (Issue #142) from src/lib/auth.ts's
// revokeSessionsAfterPasswordReset (#141) — matches both a plain string and
// an ObjectId-typed userId, since a string-only match against `session`'s
// own userId field found zero documents in real CI even when this exact
// logic was confirmed running (see auth.ts's own comment on this).
export async function revokeSessionsForUser(userId: string): Promise<void> {
  const userIdVariants: unknown[] = [userId];
  if (mongoose.isValidObjectId(userId)) {
    userIdVariants.push(new mongoose.Types.ObjectId(userId));
  }
  await mongoose.connection.db!.collection("session").deleteMany({ userId: { $in: userIdVariants } });
}
