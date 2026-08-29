import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Issue #175/M7.5 — account-home summary (profile + 5 recent orders +
// lifetime stats), composed into the existing AccountContent above its
// edit-profile section.
describe("Account home dashboard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockSignedInSession() {
    server.use(
      http.get("*/api/auth/get-session", () => {
        return HttpResponse.json({
          success: true,
          data: {
            user: { id: "user1", name: "Jane Buyer", email: "jane@example.com", role: "buyer" },
          },
        });
      }),
      http.get("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: { _id: "user1", name: "Jane Buyer", email: "jane@example.com" },
        });
      }),
    );
  }

  async function renderAccountContent() {
    const { makeStore } = await import("@/store/store");
    const { AccountContent } = await import("@/features/authentication/account/AccountContent");
    const store = makeStore();
    return render(
      <Provider store={store}>
        <AccountContent />
      </Provider>,
    );
  }

  it("shows the profile summary, recent orders, and lifetime stats for a populated buyer", async () => {
    mockSignedInSession();
    server.use(
      http.get("*/api/account/dashboard", () => {
        return HttpResponse.json({
          success: true,
          data: {
            profile: { _id: "user1", name: "Jane Buyer", email: "jane@example.com" },
            recentOrders: [
              {
                id: "order1",
                orderNumber: "TC-2026-1",
                user: "user1",
                status: "delivered",
                items: [],
                shippingAddress: {
                  fullName: "Jane Buyer",
                  phone: "9876543210",
                  line1: "1 MG Road",
                  city: "Bengaluru",
                  state: "Karnataka",
                  pincode: "560001",
                },
                totalAmount: 15000,
                statusHistory: [],
                createdAt: "2026-01-01T00:00:00.000Z",
                payment: null,
              },
            ],
            lifetimeOrderCount: 3,
            lifetimeAmountSpent: 45000,
          },
        });
      }),
    );

    await renderAccountContent();

    await waitFor(() => {
      expect(screen.getByText("Jane Buyer")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
    expect(screen.getByText("Order #TC-2026-1")).toBeInTheDocument();
  });

  it("shows an empty-order-history state for a brand-new buyer", async () => {
    mockSignedInSession();
    server.use(
      http.get("*/api/account/dashboard", () => {
        return HttpResponse.json({
          success: true,
          data: {
            profile: { _id: "user1", name: "Jane Buyer", email: "jane@example.com" },
            recentOrders: [],
            lifetimeOrderCount: 0,
            lifetimeAmountSpent: 0,
          },
        });
      }),
    );

    await renderAccountContent();

    expect(await screen.findByText(/haven.t placed any orders yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start shopping/i })).toHaveAttribute("href", "/");
  });
});
