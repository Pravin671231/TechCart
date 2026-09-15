import type { Types } from "mongoose";
import {
  createUser,
  findUserByEmail,
  findUserById,
  isDeactivated,
  isNonBuyer,
  touchLastSignIn,
} from "@/modules/user/user.repository";
import type { UserDocument } from "@/modules/user/user.model";
import { UserAuth, type UserAuthDocument } from "./userAuth.model";

// Issue #385 — identity queries are re-exported straight from the shared
// user/user.repository.ts (this module needs them constantly for sign-in
// flows); the credentials queries below are this module's own, since
// auth/ is UserAuth's owning module.
export { createUser, findUserByEmail, findUserById, isDeactivated, isNonBuyer, touchLastSignIn };
export type { UserDocument };

export async function createBuyer(input: {
  email: string;
  name: string;
  isVerified: boolean;
}): Promise<UserDocument> {
  return createUser({ email: input.email, name: input.name, role: "buyer", isVerified: input.isVerified });
}

export async function createUserAuth(
  userId: Types.ObjectId,
  input: { authProvider: "local" | "google"; googleId?: string; passwordHash?: string; twoFactorEnabled?: boolean },
): Promise<void> {
  await UserAuth.create({
    userId,
    authProvider: input.authProvider,
    ...(input.googleId !== undefined ? { googleId: input.googleId } : {}),
    ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
    ...(input.twoFactorEnabled !== undefined ? { twoFactorEnabled: input.twoFactorEnabled } : {}),
  });
}

export async function findUserAuthByUserId(userId: Types.ObjectId): Promise<UserAuthDocument | null> {
  return UserAuth.findOne({ userId }).select("+passwordHash").lean();
}

export async function setGoogleId(userId: Types.ObjectId, googleId: string): Promise<void> {
  await UserAuth.updateOne({ userId }, { $set: { googleId } });
}

// Issue #259/M3.21 — hand-rolled password-reset flow writes the new bcrypt
// hash straight to userAuth.passwordHash. upsert:true self-heals a UserAuth
// document that's somehow missing for an existing User (see the two-write,
// non-transactional note in provisionAdminUser/createBuyer callers).
export async function updatePasswordHash(userId: Types.ObjectId, passwordHash: string): Promise<void> {
  await UserAuth.updateOne({ userId }, { $set: { passwordHash } }, { upsert: true });
}
