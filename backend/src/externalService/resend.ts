import { Resend } from "resend";
import { env } from "@/config/env";

const client = new Resend(env.RESEND_API_KEY);

export async function sendOtpEmail(email: string, otp: string, purpose: "sign-in"): Promise<void> {
  const subject = purpose === "sign-in" ? "Your TechCart sign-in code" : "Your TechCart code";

  await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject,
    text: `Your TechCart sign-in code is ${otp}. It expires in 10 minutes and can only be used once.`,
    html: `<p>Your TechCart sign-in code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes and can only be used once.</p>`,
  });
}

// Emails the raw reset token, not a clickable link — no admin-app URL is
// configured anywhere in this codebase yet for any auth flow to redirect
// to, so building one here would be inventing frontend infrastructure
// ahead of need (#149 wires the real admin-app consumer later).
export async function sendResetPasswordEmail(email: string, token: string): Promise<void> {
  await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Your TechCart password reset code",
    text: `Your TechCart password reset code is ${token}. It expires in 1 hour and can only be used once.`,
    html: `<p>Your TechCart password reset code is <strong>${token}</strong>.</p><p>It expires in 1 hour and can only be used once.</p>`,
  });
}
