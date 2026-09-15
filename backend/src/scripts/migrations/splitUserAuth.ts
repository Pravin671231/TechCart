// One-time, idempotent migration for Issue #385's users → User/UserAuth
// split. Run with:
//
//   npm run migrate:split-user-auth --workspace backend
//
// against whatever database MONGODB_URI points at. Safe to re-run — every
// step first checks whether its target state is already reached.
//
// Not run automatically anywhere (no CI step, no startup hook) — this is a
// manual post-merge operation against the real deployed database, the same
// pattern this repo already uses for other manual post-merge ops (see
// backend/CLAUDE.md's Redis-removal entry). Local mongodb-memory-server test
// suites never need it: each starts from an empty database and only ever
// exercises the new User/UserAuth create paths directly.
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/config/db";
import { User } from "@/modules/user/user.model";
import { UserAuth } from "@/modules/auth/userAuth.model";

// Shape of a pre-migration `users` document — the raw driver is used for
// reads here since `passwordHash`/`twoFactorEnabled`/`emailVerified` are
// deliberately undeclared on the new User schema.
interface LegacyUserDoc {
  _id: mongoose.Types.ObjectId;
  isVerified?: boolean;
  passwordHash?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
}

function usersCollection() {
  return mongoose.connection.db!.collection<LegacyUserDoc>("users");
}

export async function runSplitUserAuthMigration(): Promise<void> {
  const legacyDocs = await usersCollection().find({}).toArray();
  let verifiedBackfilled = 0;
  let authDocsCreated = 0;
  let fieldsUnset = 0;

  for (const doc of legacyDocs) {
    if (doc.isVerified === undefined) {
      await User.updateOne({ _id: doc._id }, { $set: { isVerified: true } });
      verifiedBackfilled += 1;
    }

    const existingAuth = await UserAuth.findOne({ userId: doc._id });
    if (!existingAuth) {
      // Pre-migration accounts can't be retroactively identified as
      // Google-originated (no googleId was ever stored before this split) —
      // documented, accepted limitation (see docs/srs/features/0.3-authentication.md
      // §5's planned-amendment note). A returning Google sign-in still
      // backfills googleId going forward (auth.service.ts's
      // findOrCreateGoogleBuyer), just not authProvider retroactively.
      await UserAuth.create({
        userId: doc._id,
        authProvider: "local",
        ...(doc.passwordHash !== undefined ? { passwordHash: doc.passwordHash } : {}),
        ...(doc.twoFactorEnabled !== undefined ? { twoFactorEnabled: doc.twoFactorEnabled } : {}),
      });
      authDocsCreated += 1;
    }

    if (doc.passwordHash !== undefined || doc.twoFactorEnabled !== undefined || doc.emailVerified !== undefined) {
      await usersCollection().updateOne(
        { _id: doc._id },
        { $unset: { passwordHash: "", twoFactorEnabled: "", emailVerified: "" } },
      );
      fieldsUnset += 1;
    }
  }

  console.log(
    `migrate:split-user-auth — ${legacyDocs.length} users scanned, ` +
      `${verifiedBackfilled} isVerified backfilled, ${authDocsCreated} userAuth documents created, ` +
      `${fieldsUnset} legacy field sets removed.`,
  );
}

if (require.main === module) {
  connectDB()
    .then(runSplitUserAuthMigration)
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("migrate:split-user-auth failed:", error);
      process.exit(1);
    });
}
