import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { createStore } from "@/app/store/store";
import type { AuthState } from "@/app/store/authSlice";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";
import { ProductDetailPage } from "@/features/product-catalog/products/ProductDetailPage";
import { ProductFormPage } from "@/features/product-catalog/products/productForm/ProductFormPage";
import type { Product } from "@/features/product-catalog/products/types";

const BASE = "http://localhost:4000/api/admin";

function renderProductsApp(initialPath: string) {
  const testStore = createStore({ auth: { adminKey: "test-key" } as AuthState });
  return render(
    <Provider store={testStore}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/products/:id/edit" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const CATEGORY_A = {
  _id: "cat-a",
  name: "Smartphones",
  slug: "smartphones",
  parentCategory: null,
  sortOrder: 0,
  status: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const CATEGORY_B = {
  _id: "cat-b",
  name: "Laptops",
  slug: "laptops",
  parentCategory: null,
  sortOrder: 1,
  status: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const LIST_PAGINATION = { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false };

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    _id: "p1",
    name: "Test Phone",
    slug: "test-phone",
    description: "A phone.",
    brand: "brand-1",
    category: "cat-a",
    specifications: [],
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

function setupHandlers(
  options: {
    products?: Product[];
    createError?: { status: number; code: string; message: string };
  } = {},
) {
  let products = options.products ?? [];
  let lastCreateBody: unknown;
  let lastUpdateBody: unknown;
  let lastAddVariantBody: unknown;
  const specRequests: string[] = [];

  server.use(
    http.get(`${BASE}/brands`, () =>
      HttpResponse.json({
        success: true,
        data: [{ _id: "brand-1", name: "Brand A", slug: "brand-a" }],
        pagination: LIST_PAGINATION,
      }),
    ),
    http.get(`${BASE}/categories`, () =>
      HttpResponse.json({
        success: true,
        data: [CATEGORY_A, CATEGORY_B],
        pagination: LIST_PAGINATION,
      }),
    ),
    http.get(`${BASE}/categories/:id/specifications`, ({ params }) => {
      specRequests.push(params.id as string);
      const groups =
        params.id === "cat-a"
          ? [
              {
                groupName: "Display",
                specifications: [
                  { name: "Screen Size", type: "number", unit: "in", required: true, filterable: true },
                ],
              },
            ]
          : [
              {
                groupName: "Performance",
                specifications: [
                  { name: "CPU Cores", type: "number", required: false, filterable: false },
                ],
              },
            ];
      return HttpResponse.json({ success: true, data: { category: params.id, specificationGroups: groups } });
    }),
    http.get(`${BASE}/categories/:id/variant-types`, ({ params }) =>
      HttpResponse.json({
        success: true,
        data: {
          category: params.id,
          variants: [
            {
              name: "Storage",
              code: "storage",
              type: "select",
              required: true,
              options: [
                { label: "128GB", value: "128" },
                { label: "256GB", value: "256" },
              ],
            },
          ],
        },
      }),
    ),
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
    http.post(`${BASE}/uploads/presign`, () =>
      HttpResponse.json({
        success: true,
        data: {
          uploadUrl: "http://localhost:4000/upload-target",
          objectKey: "product-image/test.jpg",
          publicUrl: "https://cdn.example.com/product-image/test.jpg",
          expiresAt: "2026-01-01T00:05:00.000Z",
        },
      }),
    ),
    http.put("http://localhost:4000/upload-target", () => new HttpResponse(null, { status: 200 })),
    http.post(`${BASE}/products`, async ({ request }) => {
      lastCreateBody = await request.json();
      if (options.createError) {
        return HttpResponse.json(
          { success: false, code: options.createError.code, message: options.createError.message },
          { status: options.createError.status },
        );
      }
      const created = makeProduct({ _id: "new-p", ...(lastCreateBody as Partial<Product>) });
      products = [...products, created];
      return HttpResponse.json({ success: true, data: created }, { status: 201 });
    }),
    http.patch(`${BASE}/products/:id`, async ({ params, request }) => {
      lastUpdateBody = await request.json();
      products = products.map((p) => (p._id === params.id ? { ...p, ...(lastUpdateBody as Partial<Product>) } : p));
      return HttpResponse.json({ success: true, data: products.find((p) => p._id === params.id) });
    }),
    http.post(`${BASE}/products/:id/variants`, async ({ params, request }) => {
      lastAddVariantBody = await request.json();
      const body = lastAddVariantBody as { sku: string; attributes: unknown; mrp: number; discount?: number };
      const product = products.find((p) => p._id === params.id);
      if (!product) {
        return HttpResponse.json({ success: false, code: "PRODUCT_NOT_FOUND", message: "Not found" }, { status: 404 });
      }
      const variant = {
        _id: "v1",
        sku: body.sku,
        attributes: body.attributes as { name: string; value: string }[],
        images: [],
        mrp: body.mrp,
        discount: body.discount ?? 0,
        sellingPrice: body.mrp - Math.floor((body.mrp * (body.discount ?? 0)) / 100),
        active: true,
      };
      const updated = { ...product, variants: [...product.variants, variant] };
      products = products.map((p) => (p._id === params.id ? updated : p));
      return HttpResponse.json({ success: true, data: updated }, { status: 201 });
    }),
  );

  return {
    getLastCreateBody: () => lastCreateBody,
    getLastUpdateBody: () => lastUpdateBody,
    getLastAddVariantBody: () => lastAddVariantBody,
    getSpecRequests: () => specRequests,
  };
}

describe("ProductForm", () => {
  it("renders a breadcrumb link back to the products list when creating a product", async () => {
    setupHandlers();
    renderProductsApp("/products/new");

    const link = await screen.findByRole("link", { name: "Products" });
    expect(link).toHaveAttribute("href", "/products");
    expect(screen.getByText("New product")).toBeInTheDocument();
  });

  it("renders a breadcrumb link back to the products list when editing a product", async () => {
    setupHandlers({ products: [makeProduct()] });
    renderProductsApp("/products/p1/edit");

    const link = await screen.findByRole("link", { name: "Products" });
    expect(link).toHaveAttribute("href", "/products");
    expect(screen.getByText("Edit product")).toBeInTheDocument();
  });

  it("re-fetches and re-renders the category's specification inputs when the category changes", async () => {
    const handlers = setupHandlers();
    renderProductsApp("/products/new");

    const categorySelect = await screen.findByLabelText("Category *");
    await screen.findByText("Smartphones"); // wait for the <option> list to actually populate
    fireEvent.change(categorySelect, { target: { value: "cat-a" } });
    expect(await screen.findByText("Screen Size", { exact: false })).toBeInTheDocument();

    fireEvent.change(categorySelect, { target: { value: "cat-b" } });
    expect(await screen.findByText("CPU Cores", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Screen Size", { exact: false })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(handlers.getSpecRequests()).toEqual(expect.arrayContaining(["cat-a", "cat-b"]));
    });
  });

  it("creates a product and redirects to the edit route", async () => {
    setupHandlers();
    renderProductsApp("/products/new");

    await userEvent.setup().type(await screen.findByLabelText("Name *"), "New Phone");
    await screen.findByText("Brand A");
    fireEvent.change(screen.getByLabelText("Brand *"), { target: { value: "brand-1" } });
    await screen.findByText("Smartphones");
    fireEvent.change(screen.getByLabelText("Category *"), { target: { value: "cat-a" } });
    await userEvent.setup().type(screen.getByLabelText("Description *"), "A great new phone.");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Edit product")).toBeInTheDocument();
    expect(await screen.findByText("Variants")).toBeInTheDocument();
  });

  it("surfaces a SPECIFICATION_VALIDATION_FAILED error naming every offending field", async () => {
    setupHandlers({
      createError: {
        status: 400,
        code: "SPECIFICATION_VALIDATION_FAILED",
        message:
          'Specifications do not satisfy the category\'s schema: missing required field(s): Screen Size; unknown field(s): Weight.',
      },
    });
    renderProductsApp("/products/new");

    await userEvent.setup().type(await screen.findByLabelText("Name *"), "New Phone");
    await screen.findByText("Brand A");
    fireEvent.change(screen.getByLabelText("Brand *"), { target: { value: "brand-1" } });
    await screen.findByText("Smartphones");
    fireEvent.change(screen.getByLabelText("Category *"), { target: { value: "cat-a" } });
    await userEvent.setup().type(screen.getByLabelText("Description *"), "A great new phone.");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "missing required field(s): Screen Size; unknown field(s): Weight",
    );
  });

  it("adds a variant to an existing product via the embedded variant editor", async () => {
    const handlers = setupHandlers({ products: [makeProduct()] });
    renderProductsApp("/products/p1/edit");

    fireEvent.click(await screen.findByRole("button", { name: "+ Add variant" }));

    const addButton = await screen.findByRole("button", { name: "Add variant" });
    const variantForm = addButton.closest("form")!;

    fireEvent.change(within(variantForm).getByLabelText("Storage"), { target: { value: "128" } });
    fireEvent.change(within(variantForm).getByLabelText("SKU *"), {
      target: { value: "TC-SP-0001-128" },
    });
    fireEvent.change(within(variantForm).getByLabelText("MRP (₹) *"), { target: { value: "29900" } });

    fireEvent.click(addButton);

    await waitFor(() => {
      const body = handlers.getLastAddVariantBody() as { sku: string; attributes: { name: string; value: string }[] };
      expect(body.sku).toBe("TC-SP-0001-128");
      expect(body.attributes).toEqual([{ name: "Storage", value: "128" }]);
    });
  });
});
