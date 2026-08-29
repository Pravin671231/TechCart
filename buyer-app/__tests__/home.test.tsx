import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import { triggerIntersection } from "../vitest.setup";
import type { PublicProductListItem } from "@/features/products/types";

// ProductCard now renders the shared AddToCartButton, which uses
// next/navigation hooks — stub them (no test here asserts on navigation).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

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
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
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
    expect(screen.getByRole("link", { name: /Test Product/ })).toHaveAttribute(
      "href",
      "/products/test-product",
    );
  });

  it("renders the discount badge and strikethrough MRP for a product on sale", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, () =>
        HttpResponse.json(
          listBody([makeProduct({ mrp: 49900, discount: 20, sellingPrice: 39920 })]),
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

    expect(await screen.findByText("₹39,920")).toBeInTheDocument();
    expect(screen.getByText("₹49,900")).toBeInTheDocument();
    expect(screen.getByText("20% off")).toBeInTheDocument();
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

  it("appends the next page when the sentinel scrolls into view and stops at the end", async () => {
    const pagesRequested: string[] = [];
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        pagesRequested.push(page);
        const pageNum = Number(page);
        return HttpResponse.json(
          listBody([makeProduct({ _id: `p${pageNum}`, name: `Product page ${pageNum}` })], {
            page: pageNum,
            total: 3,
            totalPages: 3,
            hasNextPage: pageNum < 3,
          }),
        );
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    expect(await screen.findByText("Product page 1")).toBeInTheDocument();

    await act(async () => {
      triggerIntersection();
    });
    expect(await screen.findByText("Product page 2")).toBeInTheDocument();
    // page 1 stays rendered — pages are appended, not replaced.
    expect(screen.getByText("Product page 1")).toBeInTheDocument();

    await act(async () => {
      triggerIntersection();
    });
    expect(await screen.findByText("Product page 3")).toBeInTheDocument();

    // hasNextPage is now false — further intersections do nothing.
    await act(async () => {
      triggerIntersection();
    });
    await waitFor(() => expect(screen.getByText(/reached the end/i)).toBeInTheDocument());
    expect(pagesRequested).toEqual(["1", "2", "3"]);
  });

  it("does not fire overlapping page requests on a rapid double intersection", async () => {
    const pagesRequested: string[] = [];
    server.use(
      http.get(`${API_URL}/api/products`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") ?? "1";
        pagesRequested.push(page);
        const pageNum = Number(page);
        // A slow response keeps page 2 "in flight" across the second trigger.
        if (pageNum === 2) await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(
          listBody([makeProduct({ _id: `p${pageNum}`, name: `Product page ${pageNum}` })], {
            page: pageNum,
            total: 5,
            totalPages: 5,
            hasNextPage: true,
          }),
        );
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { HomeContent } = await import("@/features/home/HomeContent");
    render(
      <Provider store={makeStore()}>
        <HomeContent />
      </Provider>,
    );

    await screen.findByText("Product page 1");

    await act(async () => {
      triggerIntersection();
      triggerIntersection();
    });

    await screen.findByText("Product page 2");
    // Exactly one page-2 request despite two intersection events.
    expect(pagesRequested.filter((page) => page === "2")).toHaveLength(1);
  });
});
