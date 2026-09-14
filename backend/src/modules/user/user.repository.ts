import type { Types } from "mongoose";
import { User, type UserDocument } from "./user.model";

// Shared identity queries against the `User` model (Issue #385). Consumed by
// auth/ (sign-in flows), account/ (self-service profile), adminUsers/ (admin
// roster), and userDirectory/ (all-accounts listing) — each of those keeps
// its own repository for module-scoped queries (filters, projections), but
// the plain identity CRUD below lives once, here.

export async function findUserByEmail(email: string): Promise<UserDocument | null> {
  return User.findOne({ email }).lean();
}

export async function findUserById(id: Types.ObjectId): Promise<UserDocument | null> {
  return User.findById(id).lean();
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserDocument["role"];
  isVerified: boolean;
}

export async function createUser(input: CreateUserInput): Promise<UserDocument> {
  const doc = await User.create({
    email: input.email,
    name: input.name,
    role: input.role,
    status: true,
    isVerified: input.isVerified,
  });
  return doc.toObject();
}

export async function touchLastSignIn(userId: Types.ObjectId): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { lastSignInAt: new Date() } });
}

export async function updateProfile(
  id: Types.ObjectId,
  patch: { name?: string; phone?: string },
): Promise<UserDocument | null> {
  await User.updateOne({ _id: id }, { $set: patch });
  return findUserById(id);
}

export async function isNonBuyer(email: string): Promise<boolean> {
  const existing = await findUserByEmail(email);
  return existing != null && existing.role !== "buyer";
}

export async function isDeactivated(email: string): Promise<boolean> {
  const existing = await findUserByEmail(email);
  return existing?.status === false;
}
