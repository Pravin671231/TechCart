import type { Types } from "mongoose";
import { User, type UserDocument } from "@/modules/user/user.model";
import { UserAuth } from "@/modules/auth/userAuth.model";

export type UserProfileRecord = Pick<UserDocument, "_id" | "name" | "email" | "phone">;

export async function findById(id: Types.ObjectId): Promise<UserProfileRecord | null> {
  return User.findById(id, "name email phone").lean();
}

export async function updateProfile(
  id: Types.ObjectId,
  patch: { name?: string; phone?: string },
): Promise<UserProfileRecord | null> {
  await User.updateOne({ _id: id }, { $set: patch });
  return findById(id);
}

// Issue #259/M3.21 — admin self-service change-password now verifies/writes
// userAuth.passwordHash directly. Issue #385 — moved from users.passwordHash
// to the dedicated UserAuth model; upsert:true self-heals a missing row.
export async function getPasswordHash(id: Types.ObjectId): Promise<string | null> {
  const record = await UserAuth.findOne({ userId: id }).select("+passwordHash").lean();
  return record?.passwordHash ?? null;
}

export async function setPasswordHash(id: Types.ObjectId, passwordHash: string): Promise<void> {
  await UserAuth.updateOne({ userId: id }, { $set: { passwordHash } }, { upsert: true });
}
