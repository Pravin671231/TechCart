// CLI entry point for provisioning a super-admin account locally (Issue
// #140/M3.2) — run with `npm run seed:admin --workspace backend`. Same
// connect-then-run-then-disconnect shape as run.ts/upsert.ts.
//
// TEMPORARY: these credentials are hardcoded, not read from env vars, so
// this script needs zero .env setup to exercise the admin sign-in flow
// locally — a deliberate simplification for this portfolio project. Rotate
// or remove entirely once real admin provisioning (FR-AUTH-025, a POST
// /api/admin/users endpoint) exists.
import { connectDB, disconnectDB } from "@/config/db";
import { provisionAdminUser } from "./createAdminUser";

const SUPER_ADMIN_EMAIL = "admin@techcart.dev";
const SUPER_ADMIN_PASSWORD = "TechCart@Admin123";
const SUPER_ADMIN_NAME = "TechCart Super Admin";
const SUPER_ADMIN_ROLE = "super-admin" as const;

export async function seedAdmin(): Promise<void> {
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
  console.log(`Password: ${SUPER_ADMIN_PASSWORD} (temporary — see this file's header comment)`);

  await disconnectDB();
}

if (require.main === module) {
  seedAdmin().catch((error: unknown) => {
    console.error("Admin seed failed:", error);
    process.exit(1);
  });
}
