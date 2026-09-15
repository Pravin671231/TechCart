import type { AdminRole } from "@/features/authentication/auth/adminRoles";

// Issue #385 — every account in the system, not just the three admin roles
// adminUsers/types.ts's AdminUser covers.
export type UserDirectoryRole = AdminRole | "buyer";

export interface UserDirectoryEntry {
  _id: string;
  name: string;
  email: string;
  role: UserDirectoryRole;
  status: boolean;
  isVerified: boolean;
  lastSignInAt?: string;
  createdAt: string;
}
