import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";
import { server } from "./mocks/server";

describe("App", () => {
  it("renders the dashboard route once signed in", async () => {
    // Issue #174/M7.4 — "/" renders DashboardPage now, not the retired
    // LandingPlaceholder. The default shared session fixture is
    // catalog-manager (mocks/handlers.ts), so this renders CatalogDashboard.
    server.use(
      http.get("http://localhost:4000/api/admin/dashboard/catalog-summary", () =>
        HttpResponse.json({
          success: true,
          data: {
            totalProducts: 1,
            productsByStatus: { draft: 0, published: 1, archived: 0 },
            totalCategories: 1,
            activeCategories: 1,
            totalBrands: 1,
            activeBrands: 1,
          },
        }),
      ),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Total products")).toBeInTheDocument();
  });
});
