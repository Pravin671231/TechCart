// CLI orchestrator (Issue #330) — run with `npm run seed:all --workspace
// backend` (add `--reset` to also rebuild the seed buyers' orders/payments)
// to bring a clean local DB to a fully browsable state in one command:
// catalog -> users -> inventory -> orders, sharing one connection, mirroring
// searchIndexes/ensureSearchIndexes.ts's run*()-plus-CLI-wrapper pattern.
// Every standalone entry point (seed:upsert, seed:users, seed:inventory,
// seed:orders) keeps working unchanged.
import { connectDB, disconnectDB } from "@/config/db";
import { runUpsertSeed } from "./upsert";
import { runSeedUsers } from "./seedUsers";
import { runSeedInventory } from "./inventory";
import { runSeedOrders } from "./orders";

export async function runSeedAll(): Promise<void> {
  await connectDB();
  try {
    await runUpsertSeed();
    await runSeedUsers();
    await runSeedInventory();
    await runSeedOrders({ reset: process.argv.includes("--reset") });
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runSeedAll()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("seed:all failed:", error);
      process.exit(1);
    });
}
