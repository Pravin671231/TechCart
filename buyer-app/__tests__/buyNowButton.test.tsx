import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/products/test-phone",
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

const cartLine = {
  variant: {
    id: "v1",
    sku: "SKU-1",
    product: { id: "p1", name: "Test Phone", slug: "test-phone" },
    attributes: [],
    primaryImage: null,
  },
  quantity: 1,
  sellingPrice: 40000,
  lineTotal: 40000,
  unavailable: false,
};

async function renderButton(
  variantId: string | undefined,
  availability?: "in_stock" | "out_of_stock",
) {
  const { makeStore } = await import("@/store/store");
  const { BuyNowButton } = await import("@/features/cart/BuyNowButton");
  const store = makeStore();
  render(
    <Provider store={store}>
      <BuyNowButton variantId={variantId} availability={availability} />
    </Provider>,
  );
  return store;
}

describe("BuyNowButton", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled with no variant id", async () => {
    await renderButton(undefined);
    expect(await screen.findByRole("button", { name: /unavailable/i })).toBeDisabled();
  });

  it("shows a disabled Out of stock button, never a raw stock number", async () => {
    await renderButton("v1", "out_of_stock");

    const badge = await screen.findByRole("button", { name: /out of stock/i });
    expect(badge).toBeDisabled();
    expect(screen.queryByRole("button", { name: /buy now/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  it("routes an unauthenticated click to sign-in with a redirect and fires no cart request", async () => {
    const addSpy = vi.fn();
    server.use(
      http.post(`${API_URL}/api/cart/items`, () => {
        addSpy();
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    await renderButton("v1");
    await userEvent.click(await screen.findByRole("button", { name: /buy now/i }));

    expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=%2Fproducts%2Ftest-phone");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("goes straight to /checkout when the variant is already in the cart, with no add request", async () => {
    signedIn();
    const addSpy = vi.fn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "c1", items: [cartLine], itemCount: 1, subtotal: 40000 },
        }),
      ),
      http.post(`${API_URL}/api/cart/items`, () => {
        addSpy();
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    const store = await renderButton("v1");
    await screen.findByRole("button", { name: /buy now/i });
    // "Buy Now" renders regardless of session/cart state — wait for the cart
    // query to actually resolve so the in-cart branch is live before clicking.
    await waitFor(() => {
      const queries = (store.getState() as { api: { queries: Record<string, { status?: string }> } })
        .api.queries;
      expect(queries["getSession(undefined)"]?.status).toBe("fulfilled");
      expect(queries["getCart(undefined)"]?.status).toBe("fulfilled");
    });
    await userEvent.click(screen.getByRole("button", { name: /buy now/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/checkout"));
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("adds the item then navigates to /checkout for a signed-in buyer", async () => {
    signedIn();
    let currentCart = { id: "c1", items: [] as unknown[], itemCount: 0, subtotal: 0 };
    const addSpy = vi.fn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: currentCart }),
      ),
      http.post(`${API_URL}/api/cart/items`, () => {
        addSpy();
        currentCart = { id: "c1", items: [cartLine], itemCount: 1, subtotal: 40000 };
        return HttpResponse.json({ success: true, data: currentCart });
      }),
    );

    const store = await renderButton("v1");
    await screen.findByRole("button", { name: /buy now/i });
    await waitFor(() => {
      const queries = (store.getState() as { api: { queries: Record<string, { status?: string }> } })
        .api.queries;
      expect(queries["getSession(undefined)"]?.status).toBe("fulfilled");
      expect(queries["getCart(undefined)"]?.status).toBe("fulfilled");
    });
    await userEvent.click(screen.getByRole("button", { name: /buy now/i }));

    await waitFor(() => expect(addSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/checkout"));
  });

  it("shows the available count inline and does not navigate when an add hits INSUFFICIENT_STOCK", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "c1", items: [], itemCount: 0, subtotal: 0 },
        }),
      ),
      http.post(`${API_URL}/api/cart/items`, () =>
        HttpResponse.json(
          {
            success: false,
            code: "INSUFFICIENT_STOCK",
            message: "Only 2 unit(s) available for this item.",
          },
          { status: 409 },
        ),
      ),
    );

    await renderButton("v1", "in_stock");
    await userEvent.click(await screen.findByRole("button", { name: /buy now/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 2 unit(s) available");
    expect(mockPush).not.toHaveBeenCalledWith("/checkout");
  });
});
