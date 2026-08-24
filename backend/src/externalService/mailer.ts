import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";

// Issue #242/M3.14 — replaces resend.ts outright: TechCart doesn't own a
// verified sending domain, which Resend requires, so Mailtrap (no domain
// verification needed) is the email provider in every environment, dev and
// production alike.
//
// TEMPORARY — sending is currently disabled: real Mailtrap credentials
// aren't configured yet, so env.ts's MAILTRAP_* fields were reverted from
// #242's "all five required" back to optional, and sendEmail below
// console.logs the content instead of actually dialing Mailtrap whenever
// any of the five is missing. This is a short-lived local-dev workaround,
// not a permanent design change — revert both this file and env.ts's
// MAILTRAP_* fields back to required/always-send once real credentials are
// available. Every OTP/reset-link code path is otherwise unchanged.
const MAILTRAP_CONFIGURED = Boolean(
  env.MAILTRAP.HOST && env.MAILTRAP.PORT && env.MAILTRAP.USER && env.MAILTRAP.PASS && env.MAILTRAP.FROM_EMAIL,
);

let transport: Transporter | undefined;

function getTransport(): Transporter {
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: env.MAILTRAP.HOST,
    port: env.MAILTRAP.PORT,
    auth: { user: env.MAILTRAP.USER, pass: env.MAILTRAP.PASS },
  });
  return transport;
}

type EmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendEmail(content: EmailContent): Promise<void> {
  if (!MAILTRAP_CONFIGURED) {
    console.log(
      `[mailer: email sending temporarily disabled — MAILTRAP_* not configured] to=${content.to} subject="${content.subject}"\n${content.text}`,
    );
    return;
  }

  await getTransport().sendMail({ from: env.MAILTRAP.FROM_EMAIL, ...content });
}

export async function sendOtpEmail(email: string, otp: string, purpose: "sign-in"): Promise<void> {
  const subject = purpose === "sign-in" ? "Your TechCart sign-in code" : "Your TechCart code";

  await sendEmail({
    to: email,
    subject,
    text: `Your TechCart sign-in code is ${otp}. It expires in 10 minutes and can only be used once.`,
    html: `<p>Your TechCart sign-in code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes and can only be used once.</p>`,
  });
}

// A link, not a code, so it doesn't fit sendOtpEmail's signature/copy above
// — separate export (Issue #141/M3.3).
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Reset your TechCart admin password",
    text: `Reset your TechCart admin password: ${resetUrl}\n\nThis link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your TechCart admin password: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour and can only be used once. If you didn't request this, you can ignore this email.</p>`,
  });
}
