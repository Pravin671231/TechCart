import type { AdminRole } from "@/features/authentication/auth/adminRoles";

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: boolean;
  lastSignInAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdminUserInput {
  name: string;
  email: string;
  role: AdminRole;
}

export interface UpdateAdminUserInput {
  role?: AdminRole;
  status?: boolean;
}
