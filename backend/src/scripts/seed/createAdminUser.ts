// Shared admin-provisioning helper (Issue #140/M3.2) — used by both
// admin.ts's CLI entry point and __tests__/auth/admin-sign-in.api.test.ts, so
// "create a Better-Auth-compatible password credential" logic exists in
// exactly one place. This is deliberately NOT a full admin-provisioning API
// (FR-AUTH-025, a separate, larger, out-of-scope issue) — just enough to get
// one real admin account into the database to exercise the password+OTP
// sign-in flow outside of tests.
//
// The password credential is created through Better Auth's own server-side
// `auth.api.signUpEmail` rather than a raw-driver insert, since only Better
// Auth knows its own password-hash format — hand-rolling that would risk a
// hash the real sign-in flow can't verify against. `disableSignUp` was tried
// in auth.ts first but rejects `auth.api.signUpEmail` too (confirmed against
// a real CI run: "Email and password sign up is not enabled" even for this
// server-side call, not just the public HTTP route) — so sign-up stays
// enabled, and the safety property this needed comes from auth.ts's
// `rejectBuyerOnPasswordSignIn` hook instead: a self-registered account is
// always role "buyer" and can never sign in with its password regardless of
// how the credential was created.
//
// `role` and `twoFactorEnabled` aren't settable via signUpEmail's own input
// (role is `input:false` in auth.ts's additionalFields, and twoFactorEnabled
// isn't part of sign-up's payload at all) — both are patched afterwards via
// the raw MongoDB driver, the same convention auth.ts's own
// databaseHooks/hooks already use to touch the `users` collection directly.
import mongoose from "mongoose";
import { auth } from "@/lib/auth";

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

export async function provisionAdminUser(
  input: ProvisionAdminUserInput,
): Promise<ProvisionAdminUserResult> {
  const usersCollection = mongoose.connection.db!.collection<{
    email: string;
    role?: string;
    twoFactorEnabled?: boolean;
  }>("users");

  const existing = await usersCollection.findOne({ email: input.email });

  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name },
    });
  }

  await usersCollection.updateOne(
    { email: input.email },
    { $set: { role: input.role, twoFactorEnabled: true, emailVerified: true } },
  );

  return { email: input.email, role: input.role, created: !existing };
}
