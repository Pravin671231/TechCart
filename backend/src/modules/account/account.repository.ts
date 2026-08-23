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
