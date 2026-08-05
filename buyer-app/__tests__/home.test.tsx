import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { PublicProductListItem } from "@/features/products/types";

const API_URL = "http://localhost:4000";

function makeProduct(overrides: Partial<PublicProductListItem> = {}): PublicProductListItem {
  return {
    _id: "p1",
    name: "Test Product",
    slug: "test-product",
    brand: { _id: "b1", name: "TestBrand", slug: "testbrand" },
    primaryImage: { url: "https://example.com/img.jpg", alt: "Test Product" },
    mrp: 49900,
    discount: 0,
    sellingPrice: 49900,
    availability: "in_stock",
    isFeatured: false,
    cardSpecifications: [],
    ...overrides,
  };
}

function listBody(items: unknown[], pagination: Record<string, unknown> = {}) {
  return {
    success: true,
    data: items,
    pagination: {
      page: 1,
      limit: 24,
      total: items.length,
      totalPages: 1,
      hasNextPage: false,
      ...pagination,
    },
  };
}

describe("Home", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders products from a mocked GET /api/products response", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, () => HttpResponse.json(listBody([makeProduct()]))),
    );

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    expect(await screen.findByText("Test Product")).toBeInTheDocument();
    expect(screen.getByText("₹49,900")).toBeInTheDocument();
  });

  it("renders the empty state on a successful empty response", async () => {
    server.use(http.get(`${API_URL}/api/products`, () => HttpResponse.json(listBody([]))));

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    expect(await screen.findByText("No products match your filters")).toBeInTheDocument();
  });

  it("renders the error state on a failed response, without crashing", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, () =>
        HttpResponse.json(
          { success: false, code: "INTERNAL_ERROR", message: "Boom" },
          { status: 500 },
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    expect(await screen.findByText("Something went wrong loading products.")).toBeInTheDocument();
  });

  it("refetches with the new ?sort= value on sort change, with no manual refetch call", async () => {
    let lastSort: string | null = null;
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        lastSort = new URL(request.url).searchParams.get("sort");
        return HttpResponse.json(listBody([makeProduct({ name: `Product (${lastSort})` })]));
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    await screen.findByText("Product (newest)");

    await userEvent.setup().selectOptions(screen.getByLabelText("Sort"), "price_asc");

    await waitFor(() => expect(lastSort).toBe("price_asc"));
    expect(await screen.findByText("Product (price_asc)")).toBeInTheDocument();
  });
});
