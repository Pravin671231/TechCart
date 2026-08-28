import express, { Router } from "express";
import { handleRazorpayWebhookHandler } from "./webhooks.controller";

const router = Router();

// FR-PAY-023 — express.raw(), not express.json(): signature verification
// needs the exact unparsed body bytes Razorpay signed. No rbac() guard on
// this router at all (FR-PAY-024) — authenticated by signature alone.
router.post("/razorpay", express.raw({ type: "application/json" }), handleRazorpayWebhookHandler);

export default router;
