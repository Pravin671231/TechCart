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
// over run.ts's destructive full-reset one. Same connect-then-run-then-
// disconnect shape as every other seed script.
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { provisionAdminUser, type AdminRole } from "./createAdminUser";

// Buyers are passwordless (SRS v0.3 §2.1) — no password credential to create,
// so these are inserted directly against the `users` collection via the raw
// MongoDB driver with the same base fields provisionAdminUser writes
// (name/email/emailVerified/role/status/timestamps), minus passwordHash.
const SAMPLE_BUYERS = [
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
  email: string;
  created: boolean;
}> {
  const usersCollection = mongoose.connection.db!.collection("users");
  const existing = await usersCollection.findOne({ email: buyer.email });
  const now = new Date();

  await usersCollection.updateOne(
    { email: buyer.email },
    {
      $setOnInsert: {
        name: buyer.name,
        email: buyer.email,
        emailVerified: true,
        role: "buyer",
        status: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  return { email: buyer.email, created: !existing };
}

export async function seedUsers(): Promise<void> {
  await connectDB();

  for (const buyer of SAMPLE_BUYERS) {
    const result = await upsertBuyer(buyer);
    console.log(
      result.created ? `Created buyer: ${result.email}` : `Buyer already existed: ${result.email}`,
    );
  }

  for (const admin of SAMPLE_ADMINS) {
    const result = await provisionAdminUser(admin);
    console.log(
      result.created
        ? `Created ${result.role}: ${result.email}`
        : `${result.role} already existed, role/2FA confirmed: ${result.email}`,
    );
  }

  await disconnectDB();
}

if (require.main === module) {
  // Explicit exit on success — defensive, in case any transitive import ever
  // keeps an open handle (e.g. a socket) after disconnectDB() resolves.
  seedUsers()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:users failed:", error);
      process.exit(1);
    });
}
