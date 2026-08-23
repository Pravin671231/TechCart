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
    name: "Test Phone",
    slug: "test-phone",
    brand: { _id: "b1", name: "TestBrand", slug: "testbrand" },
    primaryImage: { url: "https://example.com/img.jpg", alt: "Test Phone" },
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

function mockCategoriesAndBrands() {
  server.use(
    http.get(`${API_URL}/api/categories`, () => HttpResponse.json({ success: true, data: [] })),
    http.get(`${API_URL}/api/brands`, () => HttpResponse.json({ success: true, data: [] })),
  );
}

describe("SearchContent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the active keyword and results from a mocked response", async () => {
    mockCategoriesAndBrands();
    server.use(
      http.get(`${API_URL}/api/products`, () => HttpResponse.json(listBody([makeProduct()]))),
    );

    const { makeStore } = await import("@/store/store");
    const { SearchContent } = await import("@/features/search/SearchContent");
    render(
      <Provider store={makeStore()}>
        <SearchContent q="smartphon" />
      </Provider>,
    );

    expect(screen.getByText("smartphon", { exact: false })).toBeInTheDocument();
    expect(await screen.findByText("Test Phone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Test Phone/ })).toHaveAttribute(
      "href",
      "/products/test-phone",
    );
  });

  it("defaults to relevance sort and sends the keyword as ?q=", async () => {
    mockCategoriesAndBrands();
    let lastUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/api/products`, ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json(listBody([makeProduct()]));
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { SearchContent } = await import("@/features/search/SearchContent");
    render(
      <Provider store={makeStore()}>
        <SearchContent q="smartphon" />
      </Provider>,
    );

    await screen.findByText("Test Phone");
    expect(lastUrl!.searchParams.get("q")).toBe("smartphon");
    expect(lastUrl!.searchParams.get("sort")).toBe("relevance");
  });

  it("renders the search-empty state (distinct copy) when the keyword itself returns nothing", async () => {
    mockCategoriesAndBrands();
    server.use(http.get(`${API_URL}/api/products`, () => HttpResponse.json(listBody([]))));

    const { makeStore } = await import("@/store/store");
    const { SearchContent } = await import("@/features/search/SearchContent");
    render(
      <Provider store={makeStore()}>
        <SearchContent q="xyzzy" />
      </Provider>,
    );

    expect(await screen.findByText("No results for “xyzzy”")).toBeInTheDocument();
    expect(screen.queryByText("No products match your filters")).not.toBeInTheDocument();
  });

  it("renders the filter-empty state (distinct copy) when a filter, not the keyword, is the differentiator", async () => {
    mockCategoriesAndBrands();
    server.use(http.get(`${API_URL}/api/products`, () => HttpResponse.json(listBody([]))));

    const { makeStore } = await import("@/store/store");
    const { SearchContent } = await import("@/features/search/SearchContent");
    render(
      <Provider store={makeStore()}>
        <SearchContent q="smartphon" />
      </Provider>,
    );

    await waitFor(() => expect(screen.getByText("No results for “smartphon”")).toBeInTheDocument());

    await userEvent.setup().click(screen.getByLabelText("In stock"));

    await waitFor(() => expect(screen.getByText("No products match your filters")).toBeInTheDocument());
    expect(screen.queryByText("No results for “smartphon”")).not.toBeInTheDocument();
  });
});
