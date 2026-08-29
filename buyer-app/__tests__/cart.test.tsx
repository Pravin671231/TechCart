import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { Cart, CartLineItem } from "@/features/cart/types";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/cart",
  useSearchParams: () => new URLSearchParams(),
}));

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    variant: {
      id: "v1",
      sku: "SKU-1",
      product: { id: "p1", name: "Test Phone", slug: "test-phone" },
      attributes: [{ name: "Color", value: "Black" }],
      primaryImage: { url: "https://example.com/a.jpg", alt: "Test Phone" },
    },
    quantity: 2,
    sellingPrice: 40000,
    lineTotal: 80000,
    unavailable: false,
    ...overrides,
  };
}

function cart(overrides: Partial<Cart> = {}): Cart {
  const items = overrides.items ?? [line()];
  return {
    id: "cart1",
    items,
    itemCount: items.reduce((s, l) => s + l.quantity, 0),
    subtotal: items.filter((l) => !l.unavailable).reduce((s, l) => s + l.lineTotal, 0),
    ...overrides,
  };
}

function signedIn() {
  server.use(
    http.get("*/api/auth/get-session", () =>
      HttpResponse.json({
        success: true,
        data: { user: { id: "u1", name: "Jane", email: "jane@example.com", role: "buyer" } },
      }),
    ),
  );
}

async function renderCart() {
  const { makeStore } = await import("@/store/store");
  const { CartContent } = await import("@/features/cart/CartContent");
  render(
    <Provider store={makeStore()}>
      <CartContent />
    </Provider>,
  );
}

describe("Cart page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects an unauthenticated visitor to sign-in with a redirect back", async () => {
    // default handler: get-session → data: null
    await renderCart();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=/cart");
    });
  });

  it("renders line items and a subtotal excluding unavailable lines", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: cart({
            items: [
              line({ variant: { ...line().variant, id: "v1" }, quantity: 2, lineTotal: 80000 }),
              line({
                variant: {
                  id: "v2",
                  sku: "SKU-2",
                  product: { id: "p2", name: "Old Phone", slug: "old-phone" },
                  attributes: [],
                  primaryImage: null,
                },
                quantity: 1,
                sellingPrice: 12990,
                lineTotal: 0,
                unavailable: true,
              }),
            ],
          }),
        }),
      ),
    );

    await renderCart();

    expect(await screen.findByText("Test Phone")).toBeInTheDocument();
    expect(screen.getByText("Old Phone")).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
    // subtotal = 80000 (line 1 only)
    expect(screen.getAllByText("₹80,000").length).toBeGreaterThan(0);
  });

  it("updates quantity via the stepper", async () => {
    signedIn();
    let currentCart = cart({ items: [line({ quantity: 2 })] });
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: currentCart }),
      ),
      http.patch(`${API_URL}/api/cart/items/v1`, async ({ request }) => {
        const body = (await request.json()) as { quantity: number };
        currentCart = cart({
          items: [line({ quantity: body.quantity, lineTotal: 40000 * body.quantity })],
        });
        return HttpResponse.json({ success: true, data: currentCart });
      }),
    );

    await renderCart();
    await screen.findByText("Test Phone");

    await userEvent.click(screen.getByRole("button", { name: /increase quantity/i }));

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  // Issue #190/M10.2 + #192/M10.4 (FR-INV-011)
  it("renders the available count inline when a quantity increase hits INSUFFICIENT_STOCK", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: cart({ items: [line({ quantity: 2 })] }) }),
      ),
      http.patch(`${API_URL}/api/cart/items/v1`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "INSUFFICIENT_STOCK",
            message: "Only 1 more unit(s) available for this item.",
          },
          { status: 409 },
        ),
      ),
    );

    await renderCart();
    await screen.findByText("Test Phone");

    await userEvent.click(screen.getByRole("button", { name: /increase quantity/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 1 more unit(s) available");
  });

  it("removes a line", async () => {
    signedIn();
    let currentCart = cart({ items: [line()] });
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: currentCart }),
      ),
      http.delete(`${API_URL}/api/cart/items/v1`, () => {
        currentCart = cart({ items: [] });
        return HttpResponse.json({ success: true, data: currentCart });
      }),
    );

    await renderCart();
    await screen.findByText("Test Phone");

    await userEvent.click(screen.getByRole("button", { name: /^remove$/i }));

    await waitFor(() => {
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
  });

  it("shows an empty state distinct from the loading skeleton", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: { items: [], itemCount: 0, subtotal: 0 } }),
      ),
    );

    await renderCart();

    expect(await screen.findByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("disables checkout when every line is unavailable", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: cart({ items: [line({ unavailable: true, lineTotal: 0 })] }),
        }),
      ),
    );

    await renderCart();
    const button = await screen.findByRole("button", { name: /proceed to checkout/i });
    expect(button).toBeDisabled();
  });

  it("shows an error state with retry when the cart request fails", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json(
          { success: false, code: "SERVER_ERROR", message: "boom" },
          { status: 500 },
        ),
      ),
    );

    await renderCart();
    expect(await screen.findByText(/went wrong loading your cart/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
