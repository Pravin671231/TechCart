import { Schema, model, type InferSchemaType } from "mongoose";

const adminSignInChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "users" },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AdminSignInChallenge = InferSchemaType<typeof adminSignInChallengeSchema>;

export const AdminSignInChallengeModel = model("adminSignInChallenges", adminSignInChallengeSchema);
