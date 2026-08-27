import crypto from "node:crypto";
import { Schema, Types, model } from "mongoose";

// Shared otps collection (SRS §5) replacing Better Auth's `verification`
// collection — built here to support both purposes from the start so
// Issue #259's admin 2FA reuses this file unchanged, but only the
// buyer-sign-in path is wired up by Issue #258.

export type OtpPurpose = "buyer-sign-in" | "admin-2fa";

export type OtpDocument = {
  _id: Types.ObjectId;
  email: string;
  codeHash: string;
  purpose: OtpPurpose;
  challengeId?: string; // admin-2fa only — unused by the buyer flow
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
};

const otpSchema = new Schema<OtpDocument>({
  email: { type: String, required: true },
  codeHash: { type: String, required: true },
  purpose: { type: String, required: true, enum: ["buyer-sign-in", "admin-2fa"] },
  challengeId: { type: String },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

// TTL index, mirrors passwordResetTokens.ts/session.ts's own precedent.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 });

const Otp = model<OtpDocument>("Otp", otpSchema);

const OTP_TTL_MS = 10 * 60 * 1000; // FR-AUTH-007/013 — 10 minutes, both purposes

// Issue #242/M3.14 — fixed to "123456" in every environment, including
// production, so manual sign-in testing never needs real inbox access. A
// deliberate, temporary, pre-launch-only tradeoff (see SRS §3 Security
// checklist) — must not carry into a real production launch.
function generateOtpCode(): string {
  return "123456";
}

// A 6-digit, single-use, 10-minute code isn't a target worth bcrypt's cost —
// sha256 is enough to avoid storing it in plain text at rest.
function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function requestOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const code = generateOtpCode();
  await Otp.create({
    email,
    codeHash: hashOtpCode(code),
    purpose,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    createdAt: new Date(),
  });
  return code;
}

export type VerifyOtpResult = { ok: true } | { ok: false; reason: "invalid_otp" | "otp_expired" };

export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<VerifyOtpResult> {
  const record = await Otp.findOne({ email, purpose, codeHash: hashOtpCode(code) })
    .sort({ createdAt: -1 })
    .lean();

  // A wrong code and an already-consumed one are deliberately
  // indistinguishable here — both collapse to the same buyer-facing
  // INVALID_OTP message.
  if (!record || record.consumedAt) return { ok: false, reason: "invalid_otp" };
  if (record.expiresAt <= new Date()) return { ok: false, reason: "otp_expired" };

  await Otp.updateOne({ _id: record._id }, { $set: { consumedAt: new Date() } });
  return { ok: true };
}
