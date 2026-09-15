import { Schema, model, type Types } from "mongoose";

// Issue #385 — the identity half of the former single raw-driver `users`
// collection, split from credentials (auth/userAuth.model.ts). Every other
// model's `ref: "User"` (addresses, cart, orders, products, categories,
// brands) was already written against this exact model name before it
// existed — this is what finally makes those refs resolve.
export type Role = "buyer" | "catalog-manager" | "order-manager" | "super-admin";

export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  status: boolean;
  phone?: string;
  // Replaces the old, dead `emailVerified` field every creation path used to
  // write but nothing declared or read.
  isVerified: boolean;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    role: {
      type: String,
      required: true,
      enum: ["buyer", "catalog-manager", "order-manager", "super-admin"],
      default: "buyer",
    },
    status: { type: Boolean, required: true, default: true },
    phone: { type: String, trim: true },
    isVerified: { type: Boolean, required: true, default: false },
    lastSignInAt: { type: Date },
  },
  { collection: "users", timestamps: true, versionKey: false },
);

export const User = model<UserDocument>("User", userSchema);
