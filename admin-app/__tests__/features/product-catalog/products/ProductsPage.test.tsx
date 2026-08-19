import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { createStore } from "@/app/store/store";
import type { AuthState } from "@/app/store/authSlice";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";
import { ProductDetailPage } from "@/features/product-catalog/products/ProductDetailPage";
import type { Product } from "@/features/product-catalog/products/types";

const BASE = "http://localhost:4000/api/admin";
const LOOKUP_PAGINATION = { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false };

function renderProductsApp(initialPath = "/products") {
  const testStore = createStore({ auth: { adminKey: "test-key" } as AuthState });
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    _id: "p1",
    name: "Test Phone",
    slug: "test-phone",
    description: "A phone.",
    brand: "brand-1",
    category: "cat-1",
    specifications: [{ groupName: "Display", values: [{ name: "Screen Size", value: "6.1 in" }] }],
    variants: [],
    isFeatured: false,
    status: "published",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setupHandlers(initial: Product[]) {
  let products = initial;
  let lastListUrl: URL | null = null;

  server.use(
    http.get(`${BASE}/brands`, () =>
      HttpResponse.json({
        success: true,
        data: [{ _id: "brand-1", name: "Brand A", slug: "brand-a" }],
        pagination: LOOKUP_PAGINATION,
      }),
    ),
    http.get(`${BASE}/categories`, () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            _id: "cat-1",
            name: "Smartphones",
            slug: "smartphones",
            parentCategory: "cat-0",
            sortOrder: 0,
            status: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            _id: "cat-0",
            name: "Electronics",
            slug: "electronics",
            parentCategory: null,
            sortOrder: 0,
            status: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        pagination: LOOKUP_PAGINATION,
      }),
    ),
    http.get(`${BASE}/products`, ({ request }) => {
      lastListUrl = new URL(request.url);
      return HttpResponse.json({
        success: true,
        data: products,
        pagination: { page: 1, limit: 20, total: products.length, totalPages: 1, hasNextPage: false },
      });
    }),
    http.get(`${BASE}/products/:id`, ({ params }) => {
      const product = products.find((p) => p._id === params.id);
      if (!product) {
        return HttpResponse.json(
          { success: false, code: "PRODUCT_NOT_FOUND", message: "Not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json({ success: true, data: product });
    }),
    http.patch(`${BASE}/products/:id/status`, async ({ params, request }) => {
      const body = (await request.json()) as { status: Product["status"] };
      products = products.map((p) => (p._id === params.id ? { ...p, status: body.status } : p));
      return HttpResponse.json({ success: true, data: products.find((p) => p._id === params.id) });
    }),
  );

  return { getLastListUrl: () => lastListUrl };
}

describe("ProductsPage", () => {
  it("renders the product list with resolved brand/category names", async () => {
    setupHandlers([makeProduct()]);
    renderProductsApp();

    expect(await screen.findByText("Test Phone")).toBeInTheDocument();
    expect(screen.getByText("Brand A")).toBeInTheDocument();
    expect(screen.getByText("Smartphones")).toBeInTheDocument();
  });

  it("composes search and status filters independently in the request", async () => {
    const handlers = setupHandlers([makeProduct()]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.change(screen.getByLabelText("Search products"), { target: { value: "phone" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });

    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("search")).toBe("phone");
      expect(url.searchParams.get("status")).toBe("published");
    });
  });

  it("archives a published product and restores an archived one", async () => {
    setupHandlers([makeProduct({ status: "published" })]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    const restoreButton = await screen.findByRole("button", { name: "Restore" });

    fireEvent.click(restoreButton);
    expect(await screen.findByText("Draft")).toBeInTheDocument();
  });

  it("navigates to the read-only detail view, rendering every stored field and all variants regardless of active", async () => {
    setupHandlers([
      makeProduct({
        variants: [
          {
            _id: "v1",
            sku: "TC-SP-0001-BLK-128",
            attributes: [{ name: "Colour", value: "Black" }],
            images: [],
            mrp: 49900,
            discount: 10,
            sellingPrice: 44910,
            active: true,
          },
          {
            _id: "v2",
            sku: "TC-SP-0001-WHT-128",
            attributes: [{ name: "Colour", value: "White" }],
            images: [],
            mrp: 49900,
            discount: 0,
            sellingPrice: 49900,
            active: false,
          },
        ],
      }),
    ]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.click(screen.getByRole("link", { name: "View" }));

    expect(await screen.findByText("Electronics › Smartphones")).toBeInTheDocument();
    expect(screen.getByText("Screen Size")).toBeInTheDocument();
    expect(screen.getByText("TC-SP-0001-BLK-128")).toBeInTheDocument();
    expect(screen.getByText("TC-SP-0001-WHT-128")).toBeInTheDocument();

    const inactiveRow = screen.getByText("TC-SP-0001-WHT-128").closest("tr")!;
    expect(within(inactiveRow).getByText("No")).toBeInTheDocument();
  });

  it("sorts by clicking the Name column header, toggling asc/desc via sortBy/orderBy", async () => {
    const handlers = setupHandlers([makeProduct()]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("sortBy")).toBe("name");
      expect(url.searchParams.get("orderBy")).toBe("asc");
    });

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("sortBy")).toBe("name");
      expect(url.searchParams.get("orderBy")).toBe("desc");
    });
  });

  it("debounces rapid search keystrokes into a single request", async () => {
    const handlers = setupHandlers([makeProduct()]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    const searchInput = screen.getByLabelText("Search products");
    fireEvent.change(searchInput, { target: { value: "p" } });
    fireEvent.change(searchInput, { target: { value: "ph" } });
    fireEvent.change(searchInput, { target: { value: "pho" } });

    await waitFor(() => {
      expect(handlers.getLastListUrl()!.searchParams.get("search")).toBe("pho");
    });
  });

  it("shows an in-body indicator while a filter-triggered refetch is in flight", async () => {
    const products = [makeProduct({ status: "published" })];
    server.use(
      http.get(`${BASE}/brands`, () =>
        HttpResponse.json({
          success: true,
          data: [{ _id: "brand-1", name: "Brand A", slug: "brand-a" }],
          pagination: LOOKUP_PAGINATION,
        }),
      ),
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json({ success: true, data: [], pagination: LOOKUP_PAGINATION }),
      ),
      http.get(`${BASE}/products`, async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("status")) await delay(50);
        return HttpResponse.json({
          success: true,
          data: products,
          pagination: { page: 1, limit: 20, total: products.length, totalPages: 1, hasNextPage: false },
        });
      }),
    );

    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });

    expect(await screen.findByRole("status")).toHaveTextContent("Updating…");
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
