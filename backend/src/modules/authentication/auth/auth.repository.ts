import mongoose, { Types } from "mongoose";

// Raw MongoDB driver against `users`, not a Mongoose model — mirrors
// account.repository.ts's/adminUsers.repository.ts's established
// convention exactly. Better Auth's own adapter still owns this
// collection's schema during the coexistence window (Issues #258–261), so
// a competing Mongoose model here would risk conflicting with it; reads and
// writes stay scoped to the plain field set both systems already agree on.

export type UserRecord = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
  status: boolean;
  phone?: string;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

function usersCollection() {
  return mongoose.connection.db!.collection<UserRecord>("users");
}

// No email normalization — matches every existing users-collection query in
// this codebase (case-sensitive, per auth.ts's own findExistingNonBuyer /
// rejectBuyerOnPasswordSignIn / enforceAccountNotDeactivated).
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return usersCollection().findOne({ email });
}

export async function findUserById(id: Types.ObjectId): Promise<UserRecord | null> {
  return usersCollection().findOne({ _id: id });
}

export async function createBuyer(input: { email: string; name: string }): Promise<UserRecord> {
  const now = new Date();
  const doc = {
    name: input.name,
    email: input.email,
    emailVerified: true,
    role: "buyer",
    status: true,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await usersCollection().insertOne(doc as never);
  return { _id: insertedId, ...doc };
}

// Mirrors auth.ts's own findExistingNonBuyer.
export async function isNonBuyer(email: string): Promise<boolean> {
  const existing = await findUserByEmail(email);
  return existing != null && existing.role !== "buyer";
}

// Mirrors auth.ts's own enforceAccountNotDeactivated.
export async function isDeactivated(email: string): Promise<boolean> {
  const existing = await findUserByEmail(email);
  return existing?.status === false;
}

export async function touchLastSignIn(userId: Types.ObjectId): Promise<void> {
  await usersCollection().updateOne({ _id: userId }, { $set: { lastSignInAt: new Date() } });
}
