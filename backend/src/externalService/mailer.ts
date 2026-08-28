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
  env.MAILTRAP.HOST &&
  env.MAILTRAP.PORT &&
  env.MAILTRAP.USER &&
  env.MAILTRAP.PASS &&
  env.MAILTRAP.FROM_EMAIL,
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

// Issue #159/M5.6 (FR-ORD-021-023) — order notification emails, sent via the
// same Mailtrap transport, through BullMQ's worker process (orders/
// orders.notifications.ts), never inline within a request/response cycle.
// Deliberately typed as a plain DTO here, not orders.repository.ts's
// OrderRecord, so this file stays decoupled from that module's internal
// (ObjectId-carrying) shape — same reasoning every other export in this file
// takes primitives/plain strings, not a domain record.
function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export type OrderConfirmationEmailOrder = {
  orderNumber: string;
  items: { sku: string; quantity: number; lineTotal: number }[];
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
};

export async function sendOrderConfirmationEmail(
  email: string,
  order: OrderConfirmationEmailOrder,
): Promise<void> {
  const itemLines = order.items
    .map((item) => `- ${item.sku} x${item.quantity}: ${formatRupees(item.lineTotal)}`)
    .join("\n");
  const itemRows = order.items
    .map((item) => `<li>${item.sku} × ${item.quantity} — ${formatRupees(item.lineTotal)}</li>`)
    .join("");
  const { fullName, line1, city, state, pincode } = order.shippingAddress;

  await sendEmail({
    to: email,
    subject: `Order confirmed — ${order.orderNumber}`,
    text: `Thanks for your order, ${order.orderNumber}!\n\nItems:\n${itemLines}\n\nTotal: ${formatRupees(order.totalAmount)}\n\nShipping to:\n${fullName}\n${line1}\n${city}, ${state} ${pincode}`,
    html: `<p>Thanks for your order, <strong>${order.orderNumber}</strong>!</p><p>Items:</p><ul>${itemRows}</ul><p>Total: ${formatRupees(order.totalAmount)}</p><p>Shipping to:<br/>${fullName}<br/>${line1}<br/>${city}, ${state} ${pincode}</p>`,
  });
}

export type OrderNotifiableStatus = "paid" | "shipped" | "delivered" | "cancelled";

const ORDER_STATUS_EMAIL_COPY: Record<OrderNotifiableStatus, string> = {
  paid: "We've received your payment",
  shipped: "Your order has shipped",
  delivered: "Your order has been delivered",
  cancelled: "Your order has been cancelled",
};

export async function sendOrderStatusEmail(
  email: string,
  orderNumber: string,
  status: OrderNotifiableStatus,
): Promise<void> {
  const headline = ORDER_STATUS_EMAIL_COPY[status];
  await sendEmail({
    to: email,
    subject: `${headline} — ${orderNumber}`,
    text: `${headline} for order ${orderNumber}.`,
    html: `<p>${headline} for order <strong>${orderNumber}</strong>.</p>`,
  });
}
