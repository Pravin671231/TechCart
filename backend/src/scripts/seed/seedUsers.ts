// CLI entry point for local-dev/test sample accounts (Issue #245/M3.17) —
// run with `npm run seed:users --workspace backend`. Distinct from
// seedSuperAdmin.ts (Issue #241/M3.13): that script is a real
// production-bootstrap tool and requires its credentials from the
// environment with no fallback. This one is pure local-dev/test fixture
// data — hardcoding its sample credentials is fine here, the same way
// data.ts hardcodes its catalog seed templates. Never use these
// credentials for a real deployment.
//
// Idempotent — safe to re-run repeatedly, matching upsert.ts's precedent
// over run.ts's destructive full-reset one.
//
// runSeedUsers() assumes an open connection (Issue #330 — refactored so
// seed:all can share one connection across every seed script, mirroring
// searchIndexes/ensureSearchIndexes.ts's run*()-plus-CLI-wrapper split); the
// CLI guard at the bottom owns connect/disconnect for the standalone
// `npm run seed:users` entry point.
import { Types } from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { User } from "@/modules/user/user.model";
import { UserAuth } from "@/modules/auth/userAuth.model";
import { provisionAdminUser, type AdminRole } from "./createAdminUser";

// Buyers are passwordless (SRS v0.3 §2.1) — no password credential to create,
// so these are inserted directly against the `users` collection via the raw
// MongoDB driver with the same base fields provisionAdminUser writes
// (name/email/emailVerified/role/status/timestamps), minus passwordHash.
// Exported (Issue #330) so seed/orders.ts can resolve these same buyers by
// email when run standalone, without needing seed:users in the same process.
export const SAMPLE_BUYERS = [
  { name: "Asha Rao", email: "buyer1@example.com" },
  { name: "Rohan Mehta", email: "buyer2@example.com" },
  { name: "Priya Nair", email: "buyer3@example.com" },
] as const;

// Dev/test fixtures only — deliberately hardcoded, never sourced from the
// environment (see header comment above).
const SAMPLE_ADMINS: { name: string; email: string; password: string; role: AdminRole }[] = [
  {
    name: "Sample Catalog Manager",
    email: "catalog-manager@example.com",
    password: "TechCart@Dev123",
    role: "catalog-manager",
  },
  {
    name: "Sample Order Manager",
    email: "order-manager@example.com",
    password: "TechCart@Dev123",
    role: "order-manager",
  },
];

async function upsertBuyer(buyer: { name: string; email: string }): Promise<{
  id: Types.ObjectId;
  email: string;
  created: boolean;
}> {
  const existing = await User.findOne({ email: buyer.email });

  // Issue #385 — writes across User (identity) + UserAuth (authProvider
  // only; buyers are passwordless, so no passwordHash here).
  await User.updateOne(
    { email: buyer.email },
    {
      $setOnInsert: {
        name: buyer.name,
        email: buyer.email,
        isVerified: true,
        role: "buyer",
        status: true,
      },
    },
    { upsert: true },
  );

  // updateOne's own result carries no document back — one follow-up lookup
  // gets the (possibly just-inserted) _id for the caller (Issue #330).
  const stored = await User.findOne({ email: buyer.email });
  await UserAuth.updateOne(
    { userId: stored!._id },
    { $setOnInsert: { authProvider: "local" } },
    { upsert: true },
  );

  return { id: stored!._id, email: buyer.email, created: !existing };
}

export type SeedUsersResult = {
  buyers: { id: Types.ObjectId; email: string }[];
  admins: { id: Types.ObjectId; email: string; role: AdminRole }[];
};

export async function runSeedUsers(): Promise<SeedUsersResult> {
  const buyers: SeedUsersResult["buyers"] = [];
  for (const buyer of SAMPLE_BUYERS) {
    const result = await upsertBuyer(buyer);
    console.log(
      result.created ? `Created buyer: ${result.email}` : `Buyer already existed: ${result.email}`,
    );
    buyers.push({ id: result.id, email: result.email });
  }

  const admins: SeedUsersResult["admins"] = [];
  for (const admin of SAMPLE_ADMINS) {
    const result = await provisionAdminUser(admin);
    console.log(
      result.created
        ? `Created ${result.role}: ${result.email}`
        : `${result.role} already existed, role/2FA confirmed: ${result.email}`,
    );
    admins.push({ id: result.id, email: result.email, role: result.role });
  }

  return { buyers, admins };
}

if (require.main === module) {
  // Explicit exit on success — defensive, in case any transitive import ever
  // keeps an open handle (e.g. a socket) after disconnectDB() resolves.
  connectDB()
    .then(runSeedUsers)
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:users failed:", error);
      process.exit(1);
    });
}
