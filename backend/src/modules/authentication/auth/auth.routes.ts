import express, { Router } from "express";
import { betterAuthHandler } from "@/middleware/betterAuthHandler";
import {
  getSessionHandler,
  oneTapCallbackHandler,
  sendVerificationOtpHandler,
  signInEmailOtpHandler,
  signOutHandler,
} from "./auth.controller";

const router = Router();

// Issue #258/M3.20 — hand-rolled buyer routes, mounted ABOVE the Better
// Auth catch-all below so Express matches them first; Better Auth's own
// identically-named handlers for these five paths become unreachable,
// which is the point (a full replacement, not a fallback). Each buyer
// route gets its own route-scoped express.json() — the global parser stays
// out of routes/index.ts ahead of this module's mount point, since every
// OTHER /api/auth/* path (still Better Auth's, e.g. admin sign-in) needs
// its raw, unparsed body untouched.
router.post("/one-tap/callback", express.json(), oneTapCallbackHandler);
router.post("/email-otp/send-verification-otp", express.json(), sendVerificationOtpHandler);
router.post("/sign-in/email-otp", express.json(), signInEmailOtpHandler);

// No body parsing on either — get-session is a GET, and sign-out reads only
// the token, not a body. Both try the new session engine first and next()
// through to Better Auth (the catch-all further down this same router) for
// an admin session it doesn't recognize — see auth.controller.ts.
router.get("/get-session", getSessionHandler);
router.post("/sign-out", signOutHandler);

router.all("/*splat", betterAuthHandler);

export default router;
