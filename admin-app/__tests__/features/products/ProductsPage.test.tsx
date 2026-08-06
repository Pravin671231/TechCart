import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { createStore } from "@/store/store";
import type { AuthState } from "@/store/authSlice";
import { ProductsPage } from "@/features/products/ProductsPage";
import { ProductDetailPage } from "@/features/products/ProductDetailPage";
import type { Product } from "@/features/products/types";

const BASE = "http://localhost:4000/api/admin";

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
    sku: "TC-SP-0001",
    description: "A phone.",
    brand: "brand-1",
    category: "cat-1",
    images: [{ url: "https://example.com/img.jpg", alt: "Test Phone", isPrimary: true }],
    specifications: [{ groupName: "Display", values: [{ name: "Screen Size", value: "6.1 in" }] }],
    variants: [],
    mrp: 49900,
    discount: 10,
    sellingPrice: 44910,
    stock: 128,
    lowStockThreshold: 10,
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
      HttpResponse.json({ success: true, data: [{ _id: "brand-1", name: "Brand A", slug: "brand-a" }] }),
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
    http.patch(`${BASE}/products/:id/stock`, async ({ params, request }) => {
      const body = (await request.json()) as { stock: number };
      products = products.map((p) => (p._id === params.id ? { ...p, stock: body.stock } : p));
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
    expect(screen.getByText("₹44,910")).toBeInTheDocument();
  });

  it("composes search, status, and low-stock filters independently in the request", async () => {
    const handlers = setupHandlers([makeProduct()]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.change(screen.getByLabelText("Search products"), { target: { value: "phone" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "published" } });
    fireEvent.click(screen.getByLabelText("Low stock only"));

    await waitFor(() => {
      const url = handlers.getLastListUrl()!;
      expect(url.searchParams.get("search")).toBe("phone");
      expect(url.searchParams.get("status")).toBe("published");
      expect(url.searchParams.get("lowStock")).toBe("true");
    });
  });

  it("edits stock inline via the dedicated stock endpoint", async () => {
    setupHandlers([makeProduct({ stock: 5, lowStockThreshold: 10 })]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.click(screen.getByText("5"));
    const stockInput = screen.getByLabelText("Stock for Test Phone");
    fireEvent.change(stockInput, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("40")).toBeInTheDocument();
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
            stock: 64,
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
            stock: 0,
            active: false,
          },
        ],
      }),
    ]);
    renderProductsApp();
    await screen.findByText("Test Phone");

    fireEvent.click(screen.getByRole("link", { name: "View" }));

    expect(await screen.findByText("Electronics › Smartphones")).toBeInTheDocument();
    expect(screen.getByText("TC-SP-0001")).toBeInTheDocument();
    expect(screen.getByText("Screen Size")).toBeInTheDocument();
    expect(screen.getByText("TC-SP-0001-BLK-128")).toBeInTheDocument();
    expect(screen.getByText("TC-SP-0001-WHT-128")).toBeInTheDocument();

    const inactiveRow = screen.getByText("TC-SP-0001-WHT-128").closest("tr")!;
    expect(within(inactiveRow).getByText("No")).toBeInTheDocument();
  });
});
