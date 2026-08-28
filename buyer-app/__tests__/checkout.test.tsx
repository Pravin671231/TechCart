import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { Cart, CartLineItem } from "@/features/cart/types";
import type { Address } from "@/features/addresses/types";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/checkout",
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

function address(overrides: Partial<Address> = {}): Address {
  return {
    _id: "a1",
    fullName: "Asha Rao",
    phone: "9876543210",
    line1: "221B, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560025",
    isDefault: true,
    ...overrides,
  };
}

function signedIn() {
  server.use(
    http.get("*/api/auth/get-session", () =>
      HttpResponse.json({
        success: true,
        data: { user: { id: "u1", name: "Asha", email: "asha@example.com", role: "buyer" } },
      }),
    ),
  );
}

async function renderCheckout() {
  const { makeStore } = await import("@/store/store");
  const { CheckoutContent } = await import("@/features/checkout/CheckoutContent");
  render(
    <Provider store={makeStore()}>
      <CheckoutContent />
    </Provider>,
  );
}

describe("Checkout flow", () => {
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
    await renderCheckout();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=/checkout");
    });
  });

  it("renders the cart summary and defaults to the default address", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () => HttpResponse.json({ success: true, data: cart() })),
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({
          success: true,
          data: [
            address({ _id: "a1", fullName: "Asha Rao", isDefault: true }),
            address({ _id: "a2", fullName: "Office", isDefault: false }),
          ],
        }),
      ),
    );

    await renderCheckout();

    expect(await screen.findByText(/test phone × 2/i)).toBeInTheDocument();
    const defaultRadio = (await screen.findByDisplayValue("a1")) as HTMLInputElement;
    expect(defaultRadio.checked).toBe(true);
  });

  it("adds a new address inline and selects it", async () => {
    signedIn();
    let addresses: Address[] = [address({ _id: "a1", isDefault: true })];
    server.use(
      http.get(`${API_URL}/api/cart`, () => HttpResponse.json({ success: true, data: cart() })),
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: addresses }),
      ),
      http.post(`${API_URL}/api/addresses`, async ({ request }) => {
        const body = (await request.json()) as Omit<Address, "_id" | "isDefault">;
        const created = { ...body, _id: "a2", isDefault: false };
        addresses = [...addresses, created];
        return HttpResponse.json({ success: true, data: created }, { status: 201 });
      }),
    );

    await renderCheckout();
    await screen.findByDisplayValue("a1");

    await userEvent.click(screen.getByRole("button", { name: /add a new address/i }));
    await userEvent.type(screen.getByLabelText(/full name/i), "New Address");
    await userEvent.type(screen.getByLabelText(/phone/i), "9123456780");
    await userEvent.type(screen.getByLabelText(/address line 1/i), "12 MG Road");
    await userEvent.type(screen.getByLabelText(/city/i), "Pune");
    await userEvent.type(screen.getByLabelText(/state/i), "Maharashtra");
    await userEvent.type(screen.getByLabelText(/pin code/i), "411001");
    await userEvent.click(screen.getByRole("button", { name: /^add address$/i }));

    await waitFor(() => {
      const newRadio = screen.getByDisplayValue("a2") as HTMLInputElement;
      expect(newRadio.checked).toBe(true);
    });
  });

  it("places an order and shows the confirmation", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () => HttpResponse.json({ success: true, data: cart() })),
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: [address()] }),
      ),
      http.post(`${API_URL}/api/orders`, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              id: "order1",
              orderNumber: "TC-2026-000001",
              user: "u1",
              status: "pending_payment",
              items: [
                {
                  product: { id: "p1", name: "Test Phone", slug: "test-phone" },
                  variant: {
                    id: "v1",
                    sku: "SKU-1",
                    attributes: [{ name: "Color", value: "Black" }],
                    image: null,
                  },
                  unitPrice: 40000,
                  quantity: 2,
                  lineTotal: 80000,
                },
              ],
              shippingAddress: {
                fullName: "Asha Rao",
                phone: "9876543210",
                line1: "221B, Residency Road",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560025",
              },
              totalAmount: 80000,
              statusHistory: [{ status: "pending_payment", at: "2026-08-28T00:00:00.000Z" }],
              createdAt: "2026-08-28T00:00:00.000Z",
            },
          },
          { status: 201 },
        ),
      ),
    );

    await renderCheckout();
    await screen.findByDisplayValue("a1");

    await userEvent.click(screen.getByRole("button", { name: /^place order$/i }));

    expect(await screen.findByText(/order placed/i)).toBeInTheDocument();
    expect(screen.getByText(/TC-2026-000001/)).toBeInTheDocument();
    expect(screen.queryByText(/some items were removed/i)).not.toBeInTheDocument();
  });

  it("surfaces droppedItems on the confirmation before anything else", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () => HttpResponse.json({ success: true, data: cart() })),
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: [address()] }),
      ),
      http.post(`${API_URL}/api/orders`, () =>
        HttpResponse.json(
          {
            success: true,
            data: {
              id: "order1",
              orderNumber: "TC-2026-000002",
              user: "u1",
              status: "pending_payment",
              items: [],
              shippingAddress: {
                fullName: "Asha Rao",
                phone: "9876543210",
                line1: "221B, Residency Road",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560025",
              },
              totalAmount: 0,
              statusHistory: [{ status: "pending_payment", at: "2026-08-28T00:00:00.000Z" }],
              createdAt: "2026-08-28T00:00:00.000Z",
              droppedItems: [{ sku: "SKU-1", reason: "VARIANT_UNAVAILABLE" }],
            },
          },
          { status: 201 },
        ),
      ),
    );

    await renderCheckout();
    await screen.findByDisplayValue("a1");

    await userEvent.click(screen.getByRole("button", { name: /^place order$/i }));

    expect(await screen.findByText(/some items were removed/i)).toBeInTheDocument();
    expect(screen.getByText(/SKU SKU-1/)).toBeInTheDocument();
    expect(screen.getByText(/order placed/i)).toBeInTheDocument();
  });

  it("shows a message and no place-order action when the cart has nothing available", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/cart`, () =>
        HttpResponse.json({
          success: true,
          data: cart({ items: [line({ unavailable: true, lineTotal: 0 })] }),
        }),
      ),
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: [address()] }),
      ),
    );

    await renderCheckout();

    expect(await screen.findByText(/no available items to check out/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^place order$/i })).not.toBeInTheDocument();
  });
});
