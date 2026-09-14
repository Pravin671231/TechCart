import express, { Router } from "express";
import {
  adminSendOtpHandler,
  adminSignInHandler,
  adminVerifyOtpHandler,
  getSessionHandler,
  oneTapCallbackHandler,
  requestPasswordResetHandler,
  resetPasswordHandler,
  sendVerificationOtpHandler,
  signInEmailOtpHandler,
  signOutHandler,
} from "./auth.controller";

const router = Router();

// Issue #258/M3.20 — hand-rolled buyer routes. Each gets its own
// route-scoped express.json(); the global parser is still kept out of
// routes/index.ts ahead of this module's mount point (harmless now, but
// avoids re-touching that ordering).
router.post("/one-tap/callback", express.json(), oneTapCallbackHandler);
router.post("/email-otp/send-verification-otp", express.json(), sendVerificationOtpHandler);
router.post("/sign-in/email-otp", express.json(), signInEmailOtpHandler);

// Issue #259/M3.21 — hand-rolled admin password + mandatory OTP challenge
// and password reset. Wire-compatible with admin-app's existing flow
// (paths/shapes/codes unchanged).
router.post("/sign-in/email", express.json(), adminSignInHandler);
router.post("/two-factor/send-otp", express.json(), adminSendOtpHandler);
router.post("/two-factor/verify-otp", express.json(), adminVerifyOtpHandler);
router.post("/request-password-reset", express.json(), requestPasswordResetHandler);
router.post("/reset-password", express.json(), resetPasswordHandler);

// No body parsing on either — get-session is a GET, and sign-out reads only
// the token, not a body. Both resolve the session through the custom engine
// only (Issue #260/M3.22 removed the Better Auth catch-all that used to sit
// below this) — see auth.controller.ts.
router.get("/get-session", getSessionHandler);
router.post("/sign-out", signOutHandler);

export default router;
