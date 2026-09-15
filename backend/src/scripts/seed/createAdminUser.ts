// Shared admin-provisioning helper — used by the CLI seed scripts
// (superAdmin.ts, seedUsers.ts) and the auth test suites, so "create an
// admin account with a real password" logic lives in exactly one place.
//
// Issue #385 — writes across the two split models: User (identity) +
// UserAuth (credentials, including passwordHash). Not transactional (no
// replica set in this deployment, matching the transaction:false precedent
// documented elsewhere in this codebase) — the UserAuth upsert on the
// idempotent-update branch below self-heals a UserAuth row that's somehow
// missing for an existing User.
import { Types } from "mongoose";
import { hashPassword } from "@/lib/password";
import { User } from "@/modules/user/user.model";
import { UserAuth } from "@/modules/auth/userAuth.model";

export type AdminRole = "catalog-manager" | "order-manager" | "super-admin";

// Issue #144/M3.6 — shared runtime list for routes that accept "any admin
// role" (change-password is the first; adminUsers.controller.ts/
// .repository.ts each still keep their own pre-existing local copy of this
// same literal, out of scope to consolidate here).
export const ADMIN_ROLES = [
  "catalog-manager",
  "order-manager",
  "super-admin",
] as const satisfies readonly AdminRole[];

export interface ProvisionAdminUserInput {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}

export interface ProvisionAdminUserResult {
  id: Types.ObjectId;
  email: string;
  role: AdminRole;
  created: boolean;
}

export async function provisionAdminUser(
  input: ProvisionAdminUserInput,
): Promise<ProvisionAdminUserResult> {
  const existing = await User.findOne({ email: input.email });
  const passwordHash = await hashPassword(input.password);

  if (!existing) {
    const user = await User.create({
      name: input.name,
      email: input.email,
      role: input.role,
      status: true,
      isVerified: true,
    });
    await UserAuth.create({
      userId: user._id,
      passwordHash,
      authProvider: "local",
      twoFactorEnabled: true,
    });
    return { id: user._id, email: input.email, role: input.role, created: true };
  }

  // Idempotent re-run (superAdmin.ts / seedUsers.ts run repeatedly). `status`
  // is deliberately left untouched — a deactivated account isn't silently
  // reactivated by a re-seed, matching the pre-#259 behaviour.
  await User.updateOne({ _id: existing._id }, { $set: { role: input.role, isVerified: true } });
  await UserAuth.updateOne(
    { userId: existing._id },
    { $set: { authProvider: "local", twoFactorEnabled: true, passwordHash } },
    { upsert: true },
  );

  return { id: existing._id, email: input.email, role: input.role, created: false };
}
