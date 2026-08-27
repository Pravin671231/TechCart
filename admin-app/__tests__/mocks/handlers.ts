import { http, HttpResponse } from "msw";
import type { HttpHandler } from "msw";

// Issue #148/M3.10 — a default authenticated session, so every existing
// product-catalog integration test (which assumes it's already "logged in"
// as its baseline) keeps passing once RequireAuth replaces AdminKeyGate,
// with no per-test handler wiring of their own. A test that specifically
// wants "signed out" or "wrong role" overrides this via server.use(...),
// same one-off-override convention this suite already uses everywhere else.
// Shapes match the custom backend (Issues #258–#261): get-session returns
// `data: { user }` signed in / `data: null` signed out; sign-out returns
// `data: null`; the initial /two-factor/send-otp OtpVerify now fires on
// mount (Issue #263) needs a default handler for the same reason.
const DEFAULT_SESSION_USER = {
  id: "test-admin-id",
  name: "Test Admin",
  email: "test-admin@example.com",
  role: "catalog-manager",
};

export const handlers: HttpHandler[] = [
  http.get("http://localhost:4000/api/auth/get-session", () => {
    return HttpResponse.json({ success: true, data: { user: DEFAULT_SESSION_USER } });
  }),
  http.post("http://localhost:4000/api/auth/sign-out", () => {
    return HttpResponse.json({ success: true, data: null });
  }),
  http.post("http://localhost:4000/api/auth/two-factor/send-otp", () => {
    return HttpResponse.json({ success: true, data: {} });
  }),
];
