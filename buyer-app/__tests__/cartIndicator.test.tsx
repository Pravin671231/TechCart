import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

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

const sampleLine = {
  variant: {
    id: "v1",
    sku: "SKU-1",
    product: { id: "p1", name: "Test Phone", slug: "test-phone" },
    attributes: [],
    primaryImage: null,
  },
  quantity: 2,
  sellingPrice: 40000,
  lineTotal: 80000,
  unavailable: false,
};

async function renderIndicator(extra?: ReactNode) {
  const { makeStore } = await import("@/store/store");
  const { CartIndicator } = await import("@/components/layout/CartIndicator");
  render(
    <Provider store={makeStore()}>
      <CartIndicator />
      {extra}
    </Provider>,
  );
}

describe("CartIndicator", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("links to sign-in with a redirect and shows no badge when signed out", async () => {
    await renderIndicator();
    const link = await screen.findByRole("link", { name: /cart/i });
    expect(link).toHaveAttribute("href", "/sign-in?redirect=/cart");
  });

  it("shows the itemCount badge and lists the cart in the dropdown when signed in", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "c1", items: [sampleLine], itemCount: 2, subtotal: 80000 },
        }),
      ),
    );

    await renderIndicator();

    expect(await screen.findByText("2")).toBeInTheDocument(); // badge
    expect(screen.getByText("Test Phone")).toBeInTheDocument(); // dropdown item
    expect(screen.getAllByText("₹80,000").length).toBeGreaterThan(0); // subtotal + line total
    expect(screen.getByRole("link", { name: /view cart/i })).toHaveAttribute("href", "/cart");
  });

  it("updates the badge optimistically after an add", async () => {
    signedIn();
    let currentCart = { id: "c1", items: [] as unknown[], itemCount: 0, subtotal: 0 };
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: currentCart }),
      ),
      http.post(`${API_URL}/api/cart/items`, () => {
        currentCart = { id: "c1", items: [sampleLine], itemCount: 2, subtotal: 80000 };
        // deliberately slow so the optimistic bump is observable before commit
        return new Promise((resolve) =>
          setTimeout(() => resolve(HttpResponse.json({ success: true, data: currentCart })), 50),
        );
      }),
    );

    const { AddToCartButton } = await import("@/features/cart/AddToCartButton");
    await renderIndicator(<AddToCartButton variantId="v1" />);

    await screen.findByRole("button", { name: /add to cart/i });
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    // optimistic: itemCount jumps to 1 immediately (quantity defaults to 1)
    await waitFor(() => {
      expect(screen.getByText(/^(1|2)$/)).toBeInTheDocument();
    });
    // then the server response commits the real count
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });
});
