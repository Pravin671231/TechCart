import { Resend } from "resend";
import { env } from "@/config/env";

const client = new Resend(env.RESEND.API_KEY);

export async function sendOtpEmail(email: string, otp: string, purpose: "sign-in"): Promise<void> {
  const subject = purpose === "sign-in" ? "Your TechCart sign-in code" : "Your TechCart code";

  await client.emails.send({
    from: env.RESEND.FROM_EMAIL,
    to: email,
    subject,
    text: `Your TechCart sign-in code is ${otp}. It expires in 10 minutes and can only be used once.`,
    html: `<p>Your TechCart sign-in code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes and can only be used once.</p>`,
  });
}

// A link, not a code, so it doesn't fit sendOtpEmail's signature/copy above
// — separate export (Issue #141/M3.3).
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await client.emails.send({
    from: env.RESEND.FROM_EMAIL,
    to: email,
    subject: "Reset your TechCart admin password",
    text: `Reset your TechCart admin password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your TechCart admin password: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email.</p>`,
  });
}
