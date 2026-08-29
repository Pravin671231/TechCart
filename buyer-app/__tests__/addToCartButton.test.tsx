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
  const { AddToCartButton } = await import("@/features/cart/AddToCartButton");
  const store = makeStore();
  render(
    <Provider store={store}>
      <AddToCartButton variantId={variantId} availability={availability} />
    </Provider>,
  );
  return store;
}

describe("AddToCartButton", () => {
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

  it("routes an unauthenticated click to sign-in with a redirect and fires no cart request", async () => {
    const addSpy = vi.fn();
    server.use(
      http.post(`${API_URL}/api/cart/items`, () => {
        addSpy();
        return HttpResponse.json({ success: true, data: {} });
      }),
    );

    await renderButton("v1");
    await userEvent.click(await screen.findByRole("button", { name: /add to cart/i }));

    expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=%2Fproducts%2Ftest-phone");
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("adds for a signed-in buyer and flips to 'Go to Cart'", async () => {
    signedIn();
    let currentCart = { id: "c1", items: [] as unknown[], itemCount: 0, subtotal: 0 };
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({ success: true, data: currentCart }),
      ),
      http.post(`${API_URL}/api/cart/items`, () => {
        currentCart = { id: "c1", items: [cartLine], itemCount: 1, subtotal: 40000 };
        return HttpResponse.json({ success: true, data: currentCart });
      }),
    );

    const store = await renderButton("v1");
    await screen.findByRole("button", { name: /add to cart/i });
    // Guard against a real race: the button renders "Add to Cart" regardless
    // of session/cart state, but handleClick routes to /sign-in when
    // `session` is still `undefined` (loading) rather than the resolved
    // user, and the mutation's own cache patch needs getCart's query entry
    // to already exist (it's skipped until session resolves). Wait for both
    // to actually settle before clicking, so a slow round-trip under load
    // can't make this click look signed-out or land with nowhere to patch.
    await waitFor(() => {
      const queries = (store.getState() as { api: { queries: Record<string, { status?: string }> } })
        .api.queries;
      expect(queries["getSession(undefined)"]?.status).toBe("fulfilled");
      expect(queries["getCart(undefined)"]?.status).toBe("fulfilled");
    });
    await userEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(await screen.findByRole("button", { name: /go to cart/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("navigates to /cart when the variant is already in the cart", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "c1", items: [cartLine], itemCount: 1, subtotal: 40000 },
        }),
      ),
    );

    await renderButton("v1");
    await userEvent.click(await screen.findByRole("button", { name: /go to cart/i }));
    expect(mockPush).toHaveBeenCalledWith("/cart");
  });

  // Issue #192/M10.4 (FR-INV-007)
  it("shows an Out of stock badge in place of the control, never a raw stock number", async () => {
    await renderButton("v1", "out_of_stock");

    const badge = await screen.findByRole("button", { name: /out of stock/i });
    expect(badge).toBeDisabled();
    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
  });

  // Issue #190/M10.2 + #192/M10.4 (FR-INV-009/010)
  it("renders the available count inline when an add hits INSUFFICIENT_STOCK", async () => {
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
    await userEvent.click(await screen.findByRole("button", { name: /add to cart/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only 2 unit(s) available");
  });

  it("reverts to 'Add to Cart' once the line is no longer in the cart", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: { id: "c1", items: [], itemCount: 0, subtotal: 0 },
        }),
      ),
    );

    await renderButton("v1");
    expect(await screen.findByRole("button", { name: /add to cart/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /go to cart/i })).not.toBeInTheDocument();
    });
  });
});
