// CLI entry point for provisioning the first super-admin account (Issue
// #142/M3.4, FR-AUTH-024) — run with `npm run seed:super-admin --workspace
// backend`. Same connect-then-run-then-disconnect shape as
// run.ts/upsert.ts/#140's own (now-superseded) admin.ts.
//
// Replaces #140's admin.ts: this issue is explicitly the "real" admin
// provisioning story (that file's own header comment called itself a
// temporary stopgap, "rotate or remove entirely once real admin
// provisioning... exists"). Reads SUPER_ADMIN_EMAIL/SUPER_ADMIN_NAME/
// SUPER_ADMIN_PASSWORD directly from process.env (not routed through the
// global src/config/env.ts schema — this is CLI-only, ad hoc config, same
// as every other seed script's own inputs).
//
// Issue #241/M3.13: these three vars are required, with no hardcoded
// fallback — this is a real production-bootstrap script (unlike
// seedUsers.ts's deliberately-hardcoded dev-fixture credentials), so a
// missing var fails the run loudly rather than silently provisioning a
// well-known default account, matching env.ts's own fail-fast convention.
import { connectDB, disconnectDB } from "@/config/db";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const SUPER_ADMIN_ROLE = "super-admin" as const;

export async function seedSuperAdmin(): Promise<void> {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_NAME || !SUPER_ADMIN_PASSWORD) {
    const missing = [
      !SUPER_ADMIN_EMAIL && "SUPER_ADMIN_EMAIL",
      !SUPER_ADMIN_NAME && "SUPER_ADMIN_NAME",
      !SUPER_ADMIN_PASSWORD && "SUPER_ADMIN_PASSWORD",
    ].filter((name): name is string => Boolean(name));
    console.error(`Missing required env var(s) for seed:super-admin: ${missing.join(", ")}`);
    process.exit(1);
  }

  await connectDB();

  // Dynamic import so createAdminUser.ts (which statically imports
  // @/lib/auth) is only evaluated after the DB connection is open — a static
  // top-level import here would freeze auth.ts's mongodbAdapter(mongoose
  // .connection.db!, ...) on an undefined `db`, since imports resolve before
  // this function body ever runs connectDB() above.
  const { provisionAdminUser } = await import("./createAdminUser.js");

  const result = await provisionAdminUser({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    name: SUPER_ADMIN_NAME,
    role: SUPER_ADMIN_ROLE,
  });

  console.log(
    result.created
      ? `Created super-admin account: ${result.email} (role: ${result.role})`
      : `Super-admin account already existed, role/2FA confirmed: ${result.email} (role: ${result.role})`,
  );

  await disconnectDB();
}

if (require.main === module) {
  seedSuperAdmin().catch((error: unknown) => {
    console.error("Super-admin seed failed:", error);
    process.exit(1);
  });
}
