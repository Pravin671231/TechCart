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
