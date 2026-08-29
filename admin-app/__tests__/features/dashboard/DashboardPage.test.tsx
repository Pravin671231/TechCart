import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { server } from "../../mocks/server";
import { renderWithStore } from "../../utils/renderWithStore";

const BASE = "http://localhost:4000/api/admin/dashboard";

const catalogSummary = {
  totalProducts: 10,
  productsByStatus: { draft: 2, published: 7, archived: 1 },
  totalCategories: 5,
  activeCategories: 4,
  totalBrands: 3,
  activeBrands: 3,
};

const salesSummary = {
  range: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z" },
  totalOrders: 12,
  totalRevenue: 45000,
  ordersByStatus: { paid: 10, pending_payment: 2 },
};

const salesOverTime = {
  range: { from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z" },
  bucket: "day" as const,
  series: [
    { date: "2026-01-01", revenue: 1000, orders: 1 },
    { date: "2026-01-02", revenue: 2000, orders: 2 },
  ],
};

const topProducts = {
  range: salesSummary.range,
  products: [{ productId: "p1", name: "Nova X5", slug: "nova-x5", unitsSold: 5, revenue: 25000 }],
};

function mockOrderManagerSession() {
  server.use(
    http.get("http://localhost:4000/api/auth/get-session", () =>
      HttpResponse.json({
        success: true,
        data: {
          user: { id: "om-1", name: "Order Mgr", email: "om@example.com", role: "order-manager" },
        },
      }),
    ),
  );
}

function mockSalesEndpoints() {
  server.use(
    http.get(`${BASE}/summary`, () => HttpResponse.json({ success: true, data: salesSummary })),
    http.get(`${BASE}/sales`, () => HttpResponse.json({ success: true, data: salesOverTime })),
    http.get(`${BASE}/top-products`, () => HttpResponse.json({ success: true, data: topProducts })),
  );
}

function mockCatalogEndpoint() {
  server.use(
    http.get(`${BASE}/catalog-summary`, () =>
      HttpResponse.json({ success: true, data: catalogSummary }),
    ),
  );
}

describe("DashboardPage", () => {
  it("renders the narrower catalog dashboard for a catalog-manager session, with no sales widgets", async () => {
    mockCatalogEndpoint();

    renderWithStore(<DashboardPage />);

    expect(await screen.findByText("Total products")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText("Total revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Revenue over time")).not.toBeInTheDocument();
    expect(screen.queryByText("Top products")).not.toBeInTheDocument();
  });

  it("renders the sales dashboard for an order-manager session", async () => {
    mockOrderManagerSession();
    mockSalesEndpoints();

    renderWithStore(<DashboardPage />);

    expect(await screen.findByText("Total revenue")).toBeInTheDocument();
    expect(screen.getByText("Total orders")).toBeInTheDocument();
    expect(screen.getByText("Revenue over time")).toBeInTheDocument();
    expect(await screen.findByText("Nova X5")).toBeInTheDocument();
  });

  it("refetches sales data when the date range changes", async () => {
    mockOrderManagerSession();
    let sawExplicitRange = false;
    server.use(
      http.get(`${BASE}/summary`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("from") === "2026-01-05") sawExplicitRange = true;
        return HttpResponse.json({ success: true, data: salesSummary });
      }),
      http.get(`${BASE}/sales`, () => HttpResponse.json({ success: true, data: salesOverTime })),
      http.get(`${BASE}/top-products`, () =>
        HttpResponse.json({ success: true, data: topProducts }),
      ),
    );

    renderWithStore(<DashboardPage />);
    await screen.findByText("Total revenue");

    const fromInput = screen.getByLabelText("From");
    fireEvent.change(fromInput, { target: { value: "2026-01-05" } });

    await waitFor(() => expect(sawExplicitRange).toBe(true));
  });
});
