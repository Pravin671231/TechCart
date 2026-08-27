import { http, HttpResponse, type HttpHandler } from "msw";

// Default handlers, applied to every test unless a test overrides them with
// `server.use(...)`. The Header (rendered indirectly by any full-screen
// component test) and the shared AddToCartButton both read the session and,
// when signed in, the cart — so a signed-out session + empty cart are the
// safe defaults that keep tests which don't care about auth from failing on
// an unhandled request.
export const handlers: HttpHandler[] = [
  http.get("*/api/auth/get-session", () => HttpResponse.json({ success: true, data: null })),
  http.get("*/api/cart", () =>
    HttpResponse.json({ success: true, data: { items: [], itemCount: 0, subtotal: 0 } }),
  ),
];
