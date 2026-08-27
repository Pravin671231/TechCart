// Tracks which admin a pending password-reset token belongs to (Issue
// #141/M3.3, FR-AUTH-022) — needed because Better Auth's own
// sendResetPassword callback and the /reset-password endpoint don't hand
// back enough to resolve "which user's sessions should be revoked" without
// this. Mirrors uploads.model.ts's presignedUploads collection precedent
// exactly (same stated reasoning: an in-process Map would be lost on
// restart and not shared across instances), not an in-memory store.
import { Schema, model } from "mongoose";

export type PasswordResetTokenDocument = {
  token: string;
  userId: string;
  expiresAt: Date;
};

const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>({
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// TTL index: Mongo deletes the document once expiresAt is in the past.
// expireAfterSeconds: 0 means "expire at the absolute time stored in the
// field", not "N seconds after the document was created" — same convention
// uploads.model.ts's presignedUploadSchema already uses.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetToken = model<PasswordResetTokenDocument>(
  "PasswordResetToken",
  passwordResetTokenSchema,
);

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, matches auth.ts's resetPasswordTokenExpiresIn

export async function recordResetToken(token: string, userId: string): Promise<void> {
  await PasswordResetToken.create({
    token,
    userId,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
}

// Atomic findOneAndDelete, same pattern uploads.repository.ts's consumeByKey
// already uses — not-found collapses "never issued"/"already consumed" into
// one null result, no need to distinguish the two here. The `expiresAt`
// guard rejects an expired-but-not-yet-TTL-collected token (Issue #259/M3.21
// — the hand-rolled /reset-password handler now owns expiry enforcement,
// where Better Auth's own /reset-password used to).
export async function consumeResetToken(token: string): Promise<string | null> {
  const record = await PasswordResetToken.findOneAndDelete({
    token,
    expiresAt: { $gt: new Date() },
  }).lean();
  return record?.userId ?? null;
}
