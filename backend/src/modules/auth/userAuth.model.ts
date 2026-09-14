import { Schema, model, type Types } from "mongoose";

// Issue #385 — the credentials half of the former single raw-driver `users`
// collection, split from identity (user/user.model.ts). One document per
// user, linked by `userId`. `passwordHash` keeps `select: false` as defense
// in depth, but the real fix is structural: user/adminUsers.repository.ts and
// user/userDirectory.repository.ts never import this model at all, so the
// admin roster / user directory responses can no longer leak a password hash
// even by accident.
export interface UserAuthDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  passwordHash?: string;
  authProvider: "local" | "google";
  googleId?: string;
  // Legacy Better-Auth-shaped field, admin-only, still written by
  // provisionAdminUser — kept so existing documents aren't stripped of it.
  twoFactorEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userAuthSchema = new Schema<UserAuthDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    passwordHash: { type: String, select: false },
    authProvider: { type: String, required: true, enum: ["local", "google"], default: "local" },
    googleId: { type: String },
    twoFactorEnabled: { type: Boolean },
  },
  { collection: "userAuth", timestamps: true, versionKey: false },
);

export const UserAuth = model<UserAuthDocument>("UserAuth", userAuthSchema);
