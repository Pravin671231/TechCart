import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const CATEGORIES = [
  {
    _id: "cat-electronics",
    name: "Electronics",
    slug: "electronics",
    parentCategory: null,
    sortOrder: 0,
    metaTitle: "Electronics",
    metaDescription: "",
  },
  {
    _id: "cat-smartphones",
    name: "Smartphones",
    slug: "smartphones",
    parentCategory: "cat-electronics",
    sortOrder: 0,
    metaTitle: "Smartphones",
    metaDescription: "",
  },
];

const BRANDS = [{ _id: "b1", name: "TestBrand", slug: "testbrand" }];

function mockCategoriesAndBrands() {
  server.use(
    http.get(`${API_URL}/api/categories`, () =>
      HttpResponse.json({ success: true, data: CATEGORIES }),
    ),
    http.get(`${API_URL}/api/brands`, () => HttpResponse.json({ success: true, data: BRANDS })),
  );
}

describe("CategoryContent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders products and breadcrumb from a mocked response", async () => {
    mockCategoriesAndBrands();
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, () =>
        HttpResponse.json(
          listBody([
            makeProduct({ cardSpecifications: [{ name: "RAM", value: "8GB", unit: null }] }),
          ]),
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    expect(await screen.findByText("Test Phone")).toBeInTheDocument();
    expect(screen.getByText("Electronics")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Smartphones" })).toBeInTheDocument();
    expect(screen.getByText("RAM: 8GB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Test Phone/ })).toHaveAttribute(
      "href",
      "/products/test-phone",
    );
  });

  it("renders only the filterable specs a product has, with no placeholder padding", async () => {
    mockCategoriesAndBrands();
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, () =>
        HttpResponse.json(
          listBody([
            makeProduct({
              cardSpecifications: [
                { name: "RAM", value: "8GB", unit: null },
                { name: "Storage", value: "128GB", unit: null },
              ],
            }),
          ]),
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    const article = await screen.findByText("Test Phone").then((el) => el.closest("article")!);
    expect(within(article).getAllByRole("listitem")).toHaveLength(2);
  });

  it("re-fetches with the corresponding query param when a brand filter is applied, resetting to page 1", async () => {
    mockCategoriesAndBrands();
    let lastUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, ({ request }) => {
        lastUrl = new URL(request.url);
        return HttpResponse.json(listBody([makeProduct()]));
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    await screen.findByText("Test Phone");
    expect(lastUrl!.searchParams.get("page")).toBe("1");
    expect(lastUrl!.searchParams.get("sort")).toBe("newest");

    await userEvent.setup().click(await screen.findByLabelText("TestBrand"));

    await waitFor(() => expect(lastUrl!.searchParams.get("brand")).toBe("b1"));
    expect(lastUrl!.searchParams.get("page")).toBe("1");
  });

  it("re-fetches with the new sort value on sort change", async () => {
    mockCategoriesAndBrands();
    let lastSort: string | null = null;
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, ({ request }) => {
        lastSort = new URL(request.url).searchParams.get("sort");
        return HttpResponse.json(listBody([makeProduct({ name: `Product (${lastSort})` })]));
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    await screen.findByText("Product (newest)");
    await userEvent.setup().selectOptions(screen.getByLabelText("Sort"), "price_asc");

    await waitFor(() => expect(lastSort).toBe("price_asc"));
    expect(await screen.findByText("Product (price_asc)")).toBeInTheDocument();
  });

  it("renders a not-found state for a nonexistent category, not the generic error state", async () => {
    mockCategoriesAndBrands();
    server.use(
      http.get(`${API_URL}/api/categories/does-not-exist/products`, () =>
        HttpResponse.json(
          { success: false, code: "CATEGORY_NOT_FOUND", message: "Category not found" },
          { status: 404 },
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="does-not-exist" />
      </Provider>,
    );

    expect(
      await screen.findByText("This category doesn't exist or is no longer available."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong loading products.")).not.toBeInTheDocument();
  });
});
