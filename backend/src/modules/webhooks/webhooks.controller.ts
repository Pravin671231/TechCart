import type { Request, Response } from "express";
import { handleRazorpayWebhookEvent } from "@/modules/payments/payments.service";

// FR-PAY-023-025 — req.body is a raw Buffer here (webhooks.routes.ts mounts
// express.raw() on this route specifically, not express.json()), so the
// signature is verified against the exact bytes Razorpay signed. Always
// responds 200 once the signature itself checks out — even a payload this
// backend can't correlate to a known payment is acknowledged, not retried
// (payments.service.ts's own no-op branches).
export async function handleRazorpayWebhookHandler(req: Request, res: Response): Promise<void> {
  // express.raw() only populates req.body as a Buffer when the request's
  // Content-Type matches "application/json" — a request sent with no body
  // at all (e.g. a malformed/empty delivery) leaves req.body undefined, not
  // an empty Buffer, so `.toString()` would throw before ever reaching
  // handleRazorpayWebhookEvent's own missing-signature guard below.
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const signature = req.headers["x-razorpay-signature"];
  const eventId = req.headers["x-razorpay-event-id"];

  await handleRazorpayWebhookEvent(
    rawBody,
    typeof signature === "string" ? signature : undefined,
    typeof eventId === "string" ? eventId : undefined,
  );

  res.status(200).json({ success: true });
}
