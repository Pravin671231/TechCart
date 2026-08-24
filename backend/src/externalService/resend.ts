import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";

const client = new Resend(env.RESEND.API_KEY);

// Issue #242/M3.14 — TechCart doesn't own a verified sending domain yet,
// which Resend requires; Mailtrap's sandbox needs no domain verification,
// so it's used for local dev/anything non-production instead. Production
// keeps using Resend, for whenever a real domain exists.
//
// This branching logic deliberately lives inside this file rather than
// behind a new facade module: src/lib/auth.ts and 19 test files all
// reference "@/externalService/resend" by exact path (most via
// vi.mock("@/externalService/resend", () => ({...})), mocking the whole
// module's exports wholesale) — moving the real provider selection to a new
// module would need every one of those touched for no functional gain,
// since the mocks never execute this branch anyway. Keep this file's name
// as-is; it now fronts two providers on purpose, not a rename candidate.
let mailtrapTransport: Transporter | undefined;

function getMailtrapTransport(): Transporter {
  if (mailtrapTransport) return mailtrapTransport;

  const { HOST, PORT, USER, PASS } = env.MAILTRAP;
  if (!HOST || !PORT || !USER || !PASS) {
    throw new Error(
      "Mailtrap is not configured — set MAILTRAP_HOST/MAILTRAP_PORT/MAILTRAP_USER/MAILTRAP_PASS to send email outside production.",
    );
  }

  mailtrapTransport = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    auth: { user: USER, pass: PASS },
  });
  return mailtrapTransport;
}

type EmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendEmail(content: EmailContent): Promise<void> {
  if (env.NODE_ENV === "production") {
    await client.emails.send({ from: env.RESEND.FROM_EMAIL, ...content });
    return;
  }

  await getMailtrapTransport().sendMail({ from: env.RESEND.FROM_EMAIL, ...content });
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
