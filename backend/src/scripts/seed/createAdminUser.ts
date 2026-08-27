// Shared admin-provisioning helper — used by the CLI seed scripts
// (superAdmin.ts, seedUsers.ts) and the auth test suites, so "create an
// admin account with a real password" logic lives in exactly one place.
//
// Issue #259/M3.21 — the password credential is now a bcrypt hash written
// straight to `users.passwordHash` via the raw MongoDB driver, replacing
// Better Auth's `auth.api.signUpEmail` (which stored a scrypt hash in a
// separate `account` collection). Admins are the only role with a password;
// the hand-rolled `/api/auth/sign-in/email` flow verifies against this same
// field.
import mongoose, { Types } from "mongoose";
import { hashPassword } from "@/lib/password";

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
  email: string;
  role: AdminRole;
  created: boolean;
}

interface AdminUserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  status: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function provisionAdminUser(
  input: ProvisionAdminUserInput,
): Promise<ProvisionAdminUserResult> {
  const usersCollection = mongoose.connection.db!.collection<AdminUserDoc>("users");
  const existing = await usersCollection.findOne({ email: input.email });

  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  if (!existing) {
    await usersCollection.insertOne({
      _id: new Types.ObjectId(),
      name: input.name,
      email: input.email,
      role: input.role,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    return { email: input.email, role: input.role, created: true };
  }

  // Idempotent re-run (superAdmin.ts / seedUsers.ts run repeatedly). `status`
  // is deliberately left untouched — a deactivated account isn't silently
  // reactivated by a re-seed, matching the pre-#259 behaviour.
  await usersCollection.updateOne(
    { email: input.email },
    {
      $set: {
        role: input.role,
        twoFactorEnabled: true,
        emailVerified: true,
        passwordHash,
        updatedAt: now,
      },
    },
  );

  return { email: input.email, role: input.role, created: false };
}
