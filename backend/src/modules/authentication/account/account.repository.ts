// Raw MongoDB driver against the `users` collection, not a new Mongoose
// model — same convention adminUsers.repository.ts already established
// (auth.ts's own adapter owns this collection's real schema; a second
// Mongoose schema against it would drift).
import mongoose, { Types } from "mongoose";

export type UserProfileRecord = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
};

function usersCollection() {
  return mongoose.connection.db!.collection<UserProfileRecord>("users");
}

export async function findById(id: Types.ObjectId): Promise<UserProfileRecord | null> {
  return usersCollection().findOne(
    { _id: id },
    { projection: { name: 1, email: 1, phone: 1 } },
  );
}

export async function updateProfile(
  id: Types.ObjectId,
  patch: { name?: string; phone?: string },
): Promise<UserProfileRecord | null> {
  await usersCollection().updateOne({ _id: id }, { $set: patch });
  return findById(id);
}

// Issue #259/M3.21 — admin self-service change-password now verifies/writes
// `users.passwordHash` (bcrypt) directly, replacing the Better Auth
// `auth.api.changePassword` call that no longer has a session to resolve.
export async function getPasswordHash(id: Types.ObjectId): Promise<string | null> {
  const record = await mongoose.connection
    .db!.collection<{ passwordHash?: string }>("users")
    .findOne({ _id: id }, { projection: { passwordHash: 1 } });
  return record?.passwordHash ?? null;
}

export async function setPasswordHash(id: Types.ObjectId, passwordHash: string): Promise<void> {
  await usersCollection().updateOne(
    { _id: id },
    { $set: { passwordHash, updatedAt: new Date() } },
  );
}
