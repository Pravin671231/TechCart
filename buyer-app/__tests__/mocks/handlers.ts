import { http, HttpResponse, type HttpHandler } from "msw";

// Default handlers, applied to every test unless a test overrides them with
// `server.use(...)`. The Header (rendered indirectly by any full-screen
// component test) reads the session, the cart (when signed in), and — since
// Issue #322 — the category list for its dropdown; the shared AddToCartButton
// also reads the session/cart. A signed-out session, an empty cart, and an
// empty category list are the safe defaults that keep tests which don't care
// about any of that from failing on an unhandled request.
export const handlers: HttpHandler[] = [
  http.get("*/api/auth/get-session", () => HttpResponse.json({ success: true, data: null })),
  http.get("*/api/cart", () =>
    HttpResponse.json({ success: true, data: { items: [], itemCount: 0, subtotal: 0 } }),
  ),
  http.get("*/api/categories", () => HttpResponse.json({ success: true, data: [] })),
  http.get("*/api/categories/search", () => HttpResponse.json({ success: true, data: [] })),
  // Issue #326 — the category filter rail reads this on every category page.
  http.get("*/api/categories/:slug/filters", () =>
    HttpResponse.json({
      success: true,
      data: {
        category: { _id: "c0", name: "Category", slug: "category" },
        brands: [],
        priceRange: null,
        specifications: [],
        variantAxes: [],
      },
    }),
  ),
  http.get("*/api/products", () =>
    HttpResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 24, total: 0, totalPages: 0, hasNextPage: false },
    }),
  ),
];
