import { http, HttpResponse } from "msw";
import type { HttpHandler } from "msw";

// Issue #148/M3.10 — a default authenticated session, so every existing
// product-catalog integration test (which assumes it's already "logged in"
// as its baseline) keeps passing once RequireAuth replaces AdminKeyGate,
// with no per-test handler wiring of their own. A test that specifically
// wants "signed out" or "wrong role" overrides this via server.use(...),
// same one-off-override convention this suite already uses everywhere else.
const DEFAULT_SESSION_USER = {
  id: "test-admin-id",
  name: "Test Admin",
  email: "test-admin@example.com",
  role: "catalog-manager",
};

export const handlers: HttpHandler[] = [
  http.get("http://localhost:4000/api/auth/get-session", () => {
    return HttpResponse.json({ success: true, data: { user: DEFAULT_SESSION_USER, session: {} } });
  }),
  http.post("http://localhost:4000/api/auth/sign-out", () => {
    return HttpResponse.json({ success: true, data: { success: true } });
  }),
];
