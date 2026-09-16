import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
import { server } from "./mocks/server";
import type { OrderResponse } from "@/features/orders/types";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/orders",
  useSearchParams: () => new URLSearchParams(),
}));

// PaymentStep (rendered once "Pay now" is clicked) loads the Razorpay SDK via
// next/script, which never actually loads in jsdom — this stub fires onLoad
// from an effect, matching paymentStep.test.tsx's own convention.
function MockScript({ onLoad }: { onLoad?: () => void }) {
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);
  return null;
}

vi.mock("next/script", () => ({
  default: MockScript,
}));

function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: "o1",
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
    payment: null,
    ...overrides,
  };
}

function listBody(items: OrderResponse[], pagination: Record<string, unknown> = {}) {
  return {
    success: true,
    data: items,
    pagination: {
      page: 1,
      limit: 20,
      total: items.length,
      totalPages: 1,
      hasNextPage: false,
      ...pagination,
    },
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

async function renderHistory() {
  const { makeStore } = await import("@/store/store");
  const { OrderHistoryContent } = await import("@/features/orders/OrderHistoryContent");
  render(
    <Provider store={makeStore()}>
      <OrderHistoryContent />
    </Provider>,
  );
}

async function renderDetail(id: string) {
  const { makeStore } = await import("@/store/store");
  const { OrderDetailContent } = await import("@/features/orders/OrderDetailContent");
  render(
    <Provider store={makeStore()}>
      <OrderDetailContent id={id} />
      <Toaster />
    </Provider>,
  );
}

describe("Order history", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows an empty state with no orders", async () => {
    signedIn();
    server.use(http.get(`${API_URL}/api/orders`, () => HttpResponse.json(listBody([]))));

    await renderHistory();
    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
  });

  it("renders the order list and paginates", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get("page") ?? "1";
        if (page === "2") {
          return HttpResponse.json(
            listBody([order({ id: "o2", orderNumber: "TC-2026-000002" })], {
              page: 2,
              total: 25,
              totalPages: 2,
              hasNextPage: false,
            }),
          );
        }
        return HttpResponse.json(
          listBody([order()], { page: 1, total: 25, totalPages: 2, hasNextPage: true }),
        );
      }),
    );

    await renderHistory();

    expect(await screen.findByText(/TC-2026-000001/)).toBeInTheDocument();
    expect(screen.getByText(/showing 1–20 of 25 orders/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^2$/ }));

    await waitFor(() => {
      expect(screen.getByText(/TC-2026-000002/)).toBeInTheDocument();
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("keeps the list visible with an 'Updating…' indicator during a page change", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        if (page === "2") {
          await delay(60);
          return HttpResponse.json(
            listBody([order({ id: "o2", orderNumber: "TC-2026-000002" })], {
              page: 2,
              total: 25,
              totalPages: 2,
              hasNextPage: false,
            }),
          );
        }
        return HttpResponse.json(
          listBody([order()], { page: 1, total: 25, totalPages: 2, hasNextPage: true }),
        );
      }),
    );

    await renderHistory();

    expect(await screen.findByText(/TC-2026-000001/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^2$/ }));

    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText(/TC-2026-000001/)).toBeInTheDocument();

    expect(await screen.findByText(/TC-2026-000002/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Updating…")).not.toBeInTheDocument());
  });

  it("shows an error state with retry when the list request fails", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders`, () =>
        HttpResponse.json(
          { success: false, code: "SERVER_ERROR", message: "boom" },
          { status: 500 },
        ),
      ),
    );

    await renderHistory();
    expect(await screen.findByText(/went wrong loading your orders/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("Order detail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders line items, shipping address, and the full status timeline", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({
          success: true,
          data: order({
            status: "shipped",
            statusHistory: [
              { status: "pending_payment", at: "2026-08-25T00:00:00.000Z" },
              { status: "paid", at: "2026-08-26T00:00:00.000Z" },
              { status: "processing", at: "2026-08-26T12:00:00.000Z" },
              { status: "shipped", at: "2026-08-27T00:00:00.000Z", note: "Left the warehouse" },
            ],
          }),
        }),
      ),
    );

    await renderDetail("o1");

    expect(await screen.findByText(/order #TC-2026-000001/i)).toBeInTheDocument();
    expect(screen.getByText(/221B, Residency Road/)).toBeInTheDocument();
    expect(screen.getAllByText("Pending")).toHaveLength(1);
    expect(screen.getAllByText("Paid")).toHaveLength(1);
    expect(screen.getAllByText("Processing")).toHaveLength(1);
    expect(screen.getAllByText("Shipped")).toHaveLength(2); // header badge + timeline entry
    expect(screen.getByText("Left the warehouse")).toBeInTheDocument();
  });

  it("shows the cancel button for a pending_payment order and cancelling updates the view", async () => {
    signedIn();
    let current = order({ status: "pending_payment" });
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: current }),
      ),
      http.post(`${API_URL}/api/orders/o1/cancel`, () => {
        current = {
          ...current,
          status: "cancelled",
          statusHistory: [
            ...current.statusHistory,
            { status: "cancelled", at: "2026-08-28T01:00:00.000Z" },
          ],
        };
        return HttpResponse.json({ success: true, data: current });
      }),
    );

    await renderDetail("o1");

    const cancelButton = await screen.findByRole("button", { name: /^cancel order$/i });
    await userEvent.click(cancelButton);

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^cancel order$/i }));

    // Wait for the mutation to actually resolve (status badge flips to
    // "Cancelled"), not just for the button's own label to change to its
    // disabled "Cancelling…" in-flight state — that transient label change
    // alone would already satisfy a wait keyed on "cancel order" being gone.
    await waitFor(() => {
      expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole("button", { name: /^cancel order$/i })).not.toBeInTheDocument();
  });

  it("dismissing the cancel confirmation leaves the order untouched", async () => {
    signedIn();
    let cancelCalled = false;
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "pending_payment" }) }),
      ),
      http.post(`${API_URL}/api/orders/o1/cancel`, () => {
        cancelCalled = true;
        return HttpResponse.json({ success: true, data: order({ status: "cancelled" }) });
      }),
    );

    await renderDetail("o1");

    const cancelButton = await screen.findByRole("button", { name: /^cancel order$/i });
    await userEvent.click(cancelButton);

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(cancelCalled).toBe(false);
    expect(screen.getByRole("button", { name: /^cancel order$/i })).toBeInTheDocument();
  });

  it("does not show the cancel button for a delivered order", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "delivered" }) }),
      ),
    );

    await renderDetail("o1");

    await screen.findByText(/order #TC-2026-000001/i);
    expect(screen.queryByRole("button", { name: /^cancel order$/i })).not.toBeInTheDocument();
  });

  it("shows a not-found state for a nonexistent order", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/missing`, () =>
        HttpResponse.json(
          { success: false, code: "ORDER_NOT_FOUND", message: "Order not found." },
          { status: 404 },
        ),
      ),
    );

    await renderDetail("missing");

    expect(await screen.findByText(/doesn't exist or isn't yours/i)).toBeInTheDocument();
  });

  it("shows Pay now and Add items to cart for a pending_payment order, alongside Cancel order", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "pending_payment" }) }),
      ),
    );

    await renderDetail("o1");

    expect(await screen.findByRole("button", { name: /^pay now$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^add items to cart$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel order$/i })).toBeInTheDocument();
  });

  it("does not show Pay now / Add items to cart for a paid order", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "paid" }) }),
      ),
    );

    await renderDetail("o1");

    expect(await screen.findByRole("button", { name: /^cancel order$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^pay now$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add items to cart$/i })).not.toBeInTheDocument();
  });

  it("clicking Pay now swaps in the payment retry flow", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "pending_payment" }) }),
      ),
    );

    await renderDetail("o1");

    const payNowButton = await screen.findByRole("button", { name: /^pay now$/i });
    await userEvent.click(payNowButton);

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^pay now$/i }));

    expect(screen.queryByRole("button", { name: /^pay now$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add items to cart$/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/opening secure payment/i)).toBeInTheDocument();
  });

  it("clicking Add items to cart adds every line to the cart, cancels the order, and stays on the order page", async () => {
    signedIn();
    const twoItemOrder = order({
      status: "pending_payment",
      items: [
        {
          product: { id: "p1", name: "Test Phone", slug: "test-phone" },
          variant: { id: "v1", sku: "SKU-1", attributes: [], image: null },
          unitPrice: 40000,
          quantity: 2,
          lineTotal: 80000,
        },
        {
          product: { id: "p2", name: "Test Case", slug: "test-case" },
          variant: { id: "v2", sku: "SKU-2", attributes: [], image: null },
          unitPrice: 1000,
          quantity: 1,
          lineTotal: 1000,
        },
      ],
    });

    const calls: string[] = [];
    const addedItems: { variantId: string; quantity: number }[] = [];
    let current = twoItemOrder;

    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: current }),
      ),
      http.post(`${API_URL}/api/cart/items`, async ({ request }) => {
        calls.push("add");
        const body = (await request.json()) as { variantId: string; quantity: number };
        addedItems.push(body);
        return HttpResponse.json({
          success: true,
          data: { items: [], itemCount: 0, subtotal: 0 },
        });
      }),
      http.post(`${API_URL}/api/orders/o1/cancel`, () => {
        calls.push("cancel");
        current = { ...current, status: "cancelled" };
        return HttpResponse.json({ success: true, data: current });
      }),
    );

    await renderDetail("o1");

    const addToCartButton = await screen.findByRole("button", { name: /^add items to cart$/i });
    await userEvent.click(addToCartButton);

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^add to cart$/i }));

    expect(await screen.findByText(/items added to your cart/i)).toBeInTheDocument();
    expect(addedItems).toEqual([
      { variantId: "v1", quantity: 2 },
      { variantId: "v2", quantity: 1 },
    ]);
    expect(calls).toEqual(["add", "add", "cancel"]);
    expect(mockPush).not.toHaveBeenCalledWith("/cart");
  });

  it("shows an error and does not cancel or redirect when adding an item to the cart fails", async () => {
    signedIn();
    let cancelCalled = false;
    server.use(
      http.get(`${API_URL}/api/orders/o1`, () =>
        HttpResponse.json({ success: true, data: order({ status: "pending_payment" }) }),
      ),
      http.post(`${API_URL}/api/cart/items`, () =>
        HttpResponse.json(
          { success: false, code: "INSUFFICIENT_STOCK", message: "Not enough stock available." },
          { status: 409 },
        ),
      ),
      http.post(`${API_URL}/api/orders/o1/cancel`, () => {
        cancelCalled = true;
        return HttpResponse.json({ success: true, data: order({ status: "cancelled" }) });
      }),
    );

    await renderDetail("o1");

    const addToCartButton = await screen.findByRole("button", { name: /^add items to cart$/i });
    await userEvent.click(addToCartButton);

    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^add to cart$/i }));

    expect(await screen.findByText(/not enough stock available/i)).toBeInTheDocument();
    expect(cancelCalled).toBe(false);
    expect(mockPush).not.toHaveBeenCalledWith("/cart");
  });
});
