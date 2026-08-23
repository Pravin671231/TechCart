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
// as every other seed script's own inputs), falling back to admin.ts's own
// literal defaults so local dev still needs zero .env changes to exercise
// the flow.
import { connectDB, disconnectDB } from "@/config/db";
import { provisionAdminUser } from "./createAdminUser";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@techcart.dev";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME ?? "TechCart Super Admin";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "TechCart@Admin123";
const SUPER_ADMIN_ROLE = "super-admin" as const;

export async function seedSuperAdmin(): Promise<void> {
  await connectDB();

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
  if (result.created && !process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`Password: ${SUPER_ADMIN_PASSWORD} (default — set SUPER_ADMIN_PASSWORD to override)`);
  }

  await disconnectDB();
}

if (require.main === module) {
  seedSuperAdmin().catch((error: unknown) => {
    console.error("Super-admin seed failed:", error);
    process.exit(1);
  });
}
