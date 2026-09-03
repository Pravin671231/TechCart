import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { PublicProductListItem } from "@/features/products/types";

// CategoryProductCard now renders the shared AddToCartButton (next/navigation).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/category/smartphones",
  useSearchParams: () => new URLSearchParams(),
}));

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
      limit: 10,
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

const FILTER_OPTIONS = {
  category: { _id: "cat-smartphones", name: "Smartphones", slug: "smartphones" },
  brands: [{ _id: "b1", name: "TestBrand", slug: "testbrand", productCount: 5 }],
  priceRange: { min: 9900, max: 149900 },
  specifications: [
    { name: "RAM", unit: null, type: "enum", options: ["8GB", "12GB"] },
    { name: "5G", unit: null, type: "boolean" },
  ],
  variantAxes: [
    { name: "Color", code: "color", type: "color", options: [{ label: "Black", value: "black" }] },
  ],
};

function mockCategoryPage(filterOptions: unknown = FILTER_OPTIONS) {
  server.use(
    http.get(`${API_URL}/api/categories`, () =>
      HttpResponse.json({ success: true, data: CATEGORIES }),
    ),
    http.get(`${API_URL}/api/categories/smartphones/filters`, () =>
      HttpResponse.json({ success: true, data: filterOptions }),
    ),
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
    mockCategoryPage();
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
    mockCategoryPage();
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

  it("populates the brand filter from the category-scoped /filters endpoint, with counts", async () => {
    mockCategoryPage();
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, () =>
        HttpResponse.json(listBody([makeProduct()])),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    await screen.findByText("Test Phone");
    expect(await screen.findByLabelText("TestBrand (5)")).toBeInTheDocument();
  });

  it("renders the price filter as a two-handle slider and commits minPrice from a drag", async () => {
    mockCategoryPage();
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
    // FILTER_OPTIONS.priceRange = { min: 9900, max: 149900 } → slider, not inputs.
    const [minSlider] = screen.getAllByRole("slider");
    expect(minSlider).toHaveAttribute("aria-label", "Minimum price");

    fireEvent.change(minSlider, { target: { value: "40900" } });
    fireEvent.blur(minSlider);

    // jsdom may snap the range value to the step grid; assert it committed a
    // sane in-bounds minPrice and reset to page 1, not an exact figure.
    await waitFor(() => expect(lastUrl!.searchParams.get("minPrice")).not.toBeNull());
    const committed = Number(lastUrl!.searchParams.get("minPrice"));
    expect(committed).toBeGreaterThan(9900);
    expect(committed).toBeLessThanOrEqual(149900);
    expect(lastUrl!.searchParams.get("page")).toBe("1");
  });

  it("re-fetches with the corresponding query param when a brand filter is applied, resetting to page 1", async () => {
    mockCategoryPage();
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
    expect(lastUrl!.searchParams.get("limit")).toBe("10");

    await userEvent.setup().click(await screen.findByLabelText("TestBrand (5)"));

    await waitFor(() => expect(lastUrl!.searchParams.get("brand")).toBe("b1"));
    expect(lastUrl!.searchParams.get("page")).toBe("1");
  });

  it("sends a spec facet as spec[Field]=value and a variant axis as attributeName/attributeValue", async () => {
    mockCategoryPage();
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
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText("8GB"));
    await waitFor(() => expect(lastUrl!.searchParams.get("spec[RAM]")).toBe("8GB"));

    await user.click(screen.getByLabelText("Black"));
    await waitFor(() => expect(lastUrl!.searchParams.get("attributeName")).toBe("Color"));
    expect(lastUrl!.searchParams.get("attributeValue")).toBe("black");
    expect(lastUrl!.searchParams.get("page")).toBe("1");
  });

  it("re-fetches with the new sort value on sort change", async () => {
    mockCategoryPage();
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

  it("navigates pages via the Pagination control and resets to page 1 on a filter change", async () => {
    mockCategoryPage();
    const pagesRequested: string[] = [];
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "1");
        pagesRequested.push(`${page}${url.searchParams.has("brand") ? "-brand" : ""}`);
        return HttpResponse.json(
          listBody([makeProduct({ _id: `p${page}`, name: `Phone page ${page}` })], {
            page,
            total: 14,
            totalPages: 2,
            hasNextPage: page < 2,
          }),
        );
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    expect(await screen.findByText("Phone page 1")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "2" }));

    // Page 2 replaces page 1 (no infinite-scroll accumulation).
    expect(await screen.findByText("Phone page 2")).toBeInTheDocument();
    expect(screen.queryByText("Phone page 1")).not.toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

    // A filter change resets back to page 1.
    await user.click(await screen.findByLabelText("TestBrand (5)"));
    await waitFor(() => expect(pagesRequested).toContain("1-brand"));
  });

  it("keeps the current list visible with an 'Updating…' indicator during a page change", async () => {
    mockCategoryPage();
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
        if (page > 1) await delay(60);
        return HttpResponse.json(
          listBody([makeProduct({ _id: `p${page}`, name: `Phone page ${page}` })], {
            page,
            total: 14,
            totalPages: 2,
            hasNextPage: page < 2,
          }),
        );
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    expect(await screen.findByText("Phone page 1")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "2" }));

    // While page 2 is in flight: page 1 still shown + the indicator appears.
    expect(await screen.findByText("Updating…")).toBeInTheDocument();
    expect(screen.getByText("Phone page 1")).toBeInTheDocument();

    // Once it resolves: page 2 swapped in, indicator gone.
    expect(await screen.findByText("Phone page 2")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Updating…")).not.toBeInTheDocument());
  });

  it("opens the mobile filter drawer from the Filters button", async () => {
    mockCategoryPage();
    server.use(
      http.get(`${API_URL}/api/categories/smartphones/products`, () =>
        HttpResponse.json(listBody([makeProduct()])),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { CategoryContent } = await import("@/features/category/CategoryContent");
    render(
      <Provider store={makeStore()}>
        <CategoryContent slug="smartphones" />
      </Provider>,
    );

    await screen.findByText("Test Phone");
    // The desktop rail + the drawer both render the rail; before opening, only
    // one "Price" heading (desktop rail) is present.
    expect(screen.getAllByText("Price")).toHaveLength(1);

    await userEvent.setup().click(screen.getByRole("button", { name: /Filters/ }));

    expect(screen.getByRole("button", { name: "Close filters" })).toBeInTheDocument();
    expect(screen.getAllByText("Price")).toHaveLength(2);
  });

  it("renders a not-found state for a nonexistent category, not the generic error state", async () => {
    mockCategoryPage();
    server.use(
      http.get(`${API_URL}/api/categories/does-not-exist/filters`, () =>
        HttpResponse.json({ success: true, data: FILTER_OPTIONS }),
      ),
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
