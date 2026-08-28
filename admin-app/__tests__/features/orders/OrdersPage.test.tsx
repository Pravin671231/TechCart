import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { createStore } from "@/app/store/store";
import { OrdersPage } from "@/features/orders/OrdersPage";
import { OrderDetailPage } from "@/features/orders/OrderDetailPage";
import type { AdminOrder } from "@/features/orders/types";

const SESSION_URL = "http://localhost:4000/api/auth/get-session";
const BASE = "http://localhost:4000/api/admin";

// The shared default session (mocks/handlers.ts) is catalog-manager — every
// order-management test needs the order-manager (or super-admin) role
// instead, since that's what the real backend's rbac(ORDER_ADMIN_ROLES)
// requires (route-guard/nav-visibility for the wrong role are covered by
// RequireRole.test.tsx / Shell.test.tsx, not duplicated here).
function signInAsOrderManager() {
  server.use(
    http.get(SESSION_URL, () =>
      HttpResponse.json({
        success: true,
        data: {
          user: {
            id: "om1",
            name: "Order Manager",
            email: "om@example.com",
            role: "order-manager",
          },
        },
      }),
    ),
  );
}

function renderOrdersApp(initialPath = "/orders") {
  const testStore = createStore();
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

function makeOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
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
    statusHistory: [{ status: "pending_payment", at: "2026-08-25T00:00:00.000Z" }],
    createdAt: "2026-08-25T00:00:00.000Z",
    buyer: { id: "u1", name: "Asha Rao", email: "asha@example.com" },
    payment: null,
    ...overrides,
  };
}

function setupHandlers(initial: AdminOrder[]) {
  let orders = initial;
  let lastListUrl: URL | null = null;
  let lastRefundBody: { amount?: number; reason: string } | null = null;

  server.use(
    http.get(`${BASE}/orders`, ({ request }) => {
      lastListUrl = new URL(request.url);
      return HttpResponse.json({
        success: true,
        data: orders,
        pagination: { page: 1, limit: 20, total: orders.length, totalPages: 1, hasNextPage: false },
      });
    }),
    http.get(`${BASE}/orders/:id`, ({ params }) => {
      const order = orders.find((o) => o.id === params.id);
      if (!order) {
        return HttpResponse.json(
          { success: false, code: "ORDER_NOT_FOUND", message: "Not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json({ success: true, data: order });
    }),
    http.patch(`${BASE}/orders/:id/status`, async ({ params, request }) => {
      const body = (await request.json()) as { status: AdminOrder["status"] };
      orders = orders.map((o) =>
        o.id === params.id
          ? {
              ...o,
              status: body.status,
              statusHistory: [
                ...o.statusHistory,
                { status: body.status, at: "2026-08-26T00:00:00.000Z" },
              ],
            }
          : o,
      );
      return HttpResponse.json({ success: true, data: orders.find((o) => o.id === params.id) });
    }),
    http.post(`${BASE}/orders/:id/cancel`, async ({ params, request }) => {
      const body = (await request.json()) as { reason: string };
      orders = orders.map((o) =>
        o.id === params.id
          ? {
              ...o,
              status: "cancelled",
              cancellationReason: body.reason,
              statusHistory: [
                ...o.statusHistory,
                { status: "cancelled", at: "2026-08-26T00:00:00.000Z" },
              ],
            }
          : o,
      );
      return HttpResponse.json({ success: true, data: orders.find((o) => o.id === params.id) });
    }),
    http.post(`${BASE}/orders/:id/refund`, async ({ params, request }) => {
      const body = (await request.json()) as { amount?: number; reason: string };
      lastRefundBody = body;
      const target = orders.find((o) => o.id === params.id);
      if (!target?.payment) {
        return HttpResponse.json(
          { success: false, code: "PAYMENT_NOT_FOUND", message: "No captured payment." },
          { status: 400 },
        );
      }
      const isFullRefund = body.amount === undefined || body.amount >= target.payment.amount;
      orders = orders.map((o) =>
        o.id === params.id
          ? {
              ...o,
              status: isFullRefund ? "refunded" : o.status,
              payment: {
                ...o.payment!,
                status: isFullRefund ? "refunded" : "partially_refunded",
              },
              statusHistory: isFullRefund
                ? [
                    ...o.statusHistory,
                    { status: "refunded" as const, at: "2026-08-27T00:00:00.000Z" },
                  ]
                : o.statusHistory,
            }
          : o,
      );
      return HttpResponse.json({ success: true, data: orders.find((o) => o.id === params.id) });
    }),
  );

  return { getLastListUrl: () => lastListUrl, getLastRefundBody: () => lastRefundBody };
}

describe("OrdersPage", () => {
  it("renders the order list with buyer email, status, and total", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder()]);
    renderOrdersApp();

    const orderLink = await screen.findByText("TC-2026-000001");
    const row = orderLink.closest("tr")!;
    expect(within(row).getByText("asha@example.com")).toBeInTheDocument();
    // "Pending payment" also appears as a status-filter <option>; scope to the row.
    expect(within(row).getByText("Pending payment")).toBeInTheDocument();
    expect(within(row).getByText("₹80,000")).toBeInTheDocument();
  });

  it("composes search and status filters independently in the request", async () => {
    signInAsOrderManager();
    const handlers = setupHandlers([makeOrder()]);
    renderOrdersApp();
    await screen.findByText("TC-2026-000001");

    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "asha" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "paid" } });

    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("search")).toBe("asha");
      expect(url.searchParams.get("status")).toBe("paid");
    });
  });

  it("sorts by clicking the Total column header, toggling asc/desc via sortBy/orderBy", async () => {
    signInAsOrderManager();
    const handlers = setupHandlers([makeOrder()]);
    renderOrdersApp();
    await screen.findByText("TC-2026-000001");

    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("sortBy")).toBe("totalAmount");
      expect(url.searchParams.get("orderBy")).toBe("asc");
    });

    fireEvent.click(screen.getByRole("button", { name: "Total" }));
    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("orderBy")).toBe("desc");
    });
  });

  it("navigates to the detail view, rendering items, shipping address, and the status timeline", async () => {
    signInAsOrderManager();
    setupHandlers([
      makeOrder({
        statusHistory: [
          { status: "pending_payment", at: "2026-08-25T00:00:00.000Z" },
          { status: "paid", at: "2026-08-26T00:00:00.000Z" },
        ],
      }),
    ]);
    renderOrdersApp();
    await screen.findByText("TC-2026-000001");

    fireEvent.click(screen.getByRole("link", { name: "TC-2026-000001" }));

    expect(
      await screen.findByRole("heading", { name: /Order #TC-2026-000001/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Test Phone")).toBeInTheDocument();
    expect(screen.getByText(/221B, Residency Road/)).toBeInTheDocument();
    // Both timeline entries render (Pending payment appears in the header
    // badge too, so scope to distinguishing the second entry exists at all).
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
  });

  it("the status-advance control only ever offers legal next states", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "pending_payment" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    const select = screen.getByLabelText(/change status/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);

    // pending_payment's only legal next states are paid/cancelled (plus its
    // own current value) — never processing/shipped/delivered/refunded.
    expect(optionValues.sort()).toEqual(["cancelled", "paid", "pending_payment"].sort());
  });

  it("advancing status updates the view via the constrained select", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "pending_payment" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    const select = screen.getByLabelText(/change status/i);
    fireEvent.change(select, { target: { value: "paid" } });

    await waitFor(() => {
      expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
    });
  });

  it("disables the status-advance control for a terminal status", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "cancelled" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    expect(screen.getByLabelText(/change status/i)).toBeDisabled();
  });

  it("shows the cancel action only for pending_payment/paid, not for a terminal status", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "delivered" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    expect(screen.queryByRole("button", { name: /cancel order/i })).not.toBeInTheDocument();
  });

  it("requires a reason before the cancel action can be confirmed, then cancels the order", async () => {
    const user = userEvent.setup();
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "paid" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    await user.click(screen.getByRole("button", { name: /^cancel order$/i }));

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /^cancel order$/i });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/cancellation reason/i), "Item out of stock");
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  it("never offers 'refunded' as a generic status-advance option", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "delivered" })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    const select = screen.getByLabelText(/change status/i) as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((option) => option.value);

    expect(optionValues).not.toContain("refunded");
  });

  it("shows the Refund action only when the payment is captured/partially_refunded", async () => {
    signInAsOrderManager();
    setupHandlers([makeOrder({ status: "paid", payment: { status: "created", amount: 8000000 } })]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    expect(screen.queryByRole("button", { name: /^refund$/i })).not.toBeInTheDocument();
  });

  it("processes a full refund (amount left blank) and transitions the order to refunded", async () => {
    const user = userEvent.setup();
    signInAsOrderManager();
    const handlers = setupHandlers([
      makeOrder({ status: "paid", payment: { status: "captured", amount: 8000000 } }),
    ]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    await user.click(screen.getByRole("button", { name: /^refund$/i }));

    const dialog = await screen.findByRole("alertdialog");
    const confirmButton = within(dialog).getByRole("button", { name: /^refund order$/i });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/refund reason/i), "Customer request");
    expect(confirmButton).not.toBeDisabled();

    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Refunded").length).toBeGreaterThan(0);
    expect(handlers.getLastRefundBody()).toEqual({ amount: undefined, reason: "Customer request" });
  });

  it("processes a partial refund, converting the entered rupee amount to paise", async () => {
    const user = userEvent.setup();
    signInAsOrderManager();
    const handlers = setupHandlers([
      makeOrder({ status: "paid", payment: { status: "captured", amount: 8000000 } }),
    ]);
    renderOrdersApp("/orders/o1");

    await screen.findByRole("heading", { name: /Order #TC-2026-000001/ });
    await user.click(screen.getByRole("button", { name: /^refund$/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText(/refund amount/i), "100");
    await user.type(within(dialog).getByLabelText(/refund reason/i), "Partial goodwill refund");
    await user.click(within(dialog).getByRole("button", { name: /^refund order$/i }));

    await waitFor(() => {
      expect(handlers.getLastRefundBody()).toEqual({
        amount: 10000,
        reason: "Partial goodwill refund",
      });
    });
    // A partial refund leaves the order's own status untouched — still "Paid".
    expect(screen.getAllByText("Paid").length).toBeGreaterThan(0);
  });
});
