import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { PublicProductDetail } from "@/features/products/types";

// ProductDetailContent now renders the shared AddToCartButton (next/navigation).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/products/test-phone",
  useSearchParams: () => new URLSearchParams(),
}));

const API_URL = "http://localhost:4000";

function makeDetail(overrides: Partial<PublicProductDetail> = {}): PublicProductDetail {
  return {
    _id: "p1",
    name: "Test Phone",
    slug: "test-phone",
    sku: "TP-001",
    description: "A very good test phone.",
    brand: { _id: "b1", name: "TestBrand", slug: "testbrand" },
    category: { _id: "c1", name: "Smartphones", slug: "smartphones" },
    images: [{ url: "https://example.com/img.jpg", alt: "Test Phone" }],
    mrp: 49900,
    discount: 0,
    sellingPrice: 49900,
    isFeatured: false,
    specifications: [{ groupName: "Display", values: [{ name: "Screen Size", value: "6.1 in" }] }],
    hasVariants: false,
    variants: [],
    metaTitle: "Test Phone",
    metaDescription: "A very good test phone.",
    ...overrides,
  };
}

describe("ProductDetailContent", () => {
  let callCount: number;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    callCount = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pre-selects the default variant's price/availability/images when defaultVariantId is present", async () => {
    const detail = makeDetail({
      hasVariants: true,
      defaultVariantId: "v1",
      mrp: 29900,
      discount: 0,
      sellingPrice: 29900,
      images: [{ url: "https://example.com/128gb.jpg", alt: "128GB" }],
      variants: [
        {
          _id: "v1",
          sku: "TP-128",
          attributes: [{ name: "Storage", value: "128GB" }],
          images: [{ url: "https://example.com/128gb.jpg", alt: "128GB" }],
          mrp: 29900,
          discount: 0,
          sellingPrice: 29900,
          availability: "in_stock",
        },
        {
          _id: "v2",
          sku: "TP-256",
          attributes: [{ name: "Storage", value: "256GB" }],
          images: [{ url: "https://example.com/256gb.jpg", alt: "256GB" }],
          mrp: 34900,
          discount: 0,
          sellingPrice: 34900,
          availability: "in_stock",
        },
      ],
    });
    server.use(
      http.get(`${API_URL}/api/products/test-phone`, () => {
        callCount += 1;
        return HttpResponse.json({ success: true, data: detail });
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { ProductDetailContent } = await import("@/features/productDetail/ProductDetailContent");
    render(
      <Provider store={makeStore()}>
        <ProductDetailContent slug="test-phone" />
      </Provider>,
    );

    expect(await screen.findByText("₹29,900")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "128GB" })).toHaveAttribute("aria-pressed", "true");
    expect(callCount).toBe(1);
  });

  it("updates the display on variant selection with no additional network request", async () => {
    const detail = makeDetail({
      hasVariants: true,
      defaultVariantId: "v1",
      mrp: 29900,
      sellingPrice: 29900,
      variants: [
        {
          _id: "v1",
          sku: "TP-128",
          attributes: [{ name: "Storage", value: "128GB" }],
          images: [{ url: "https://example.com/128gb.jpg" }],
          mrp: 29900,
          discount: 0,
          sellingPrice: 29900,
          availability: "in_stock",
        },
        {
          _id: "v2",
          sku: "TP-256",
          attributes: [{ name: "Storage", value: "256GB" }],
          images: [{ url: "https://example.com/256gb.jpg" }],
          mrp: 34900,
          discount: 0,
          sellingPrice: 34900,
          availability: "in_stock",
        },
      ],
    });
    server.use(
      http.get(`${API_URL}/api/products/test-phone`, () => {
        callCount += 1;
        return HttpResponse.json({ success: true, data: detail });
      }),
    );

    const { makeStore } = await import("@/store/store");
    const { ProductDetailContent } = await import("@/features/productDetail/ProductDetailContent");
    render(
      <Provider store={makeStore()}>
        <ProductDetailContent slug="test-phone" />
      </Provider>,
    );

    await screen.findByText("₹29,900");
    expect(callCount).toBe(1);

    await userEvent.setup().click(screen.getByRole("button", { name: "256GB" }));

    expect(await screen.findByText("₹34,900")).toBeInTheDocument();
    expect(callCount).toBe(1);
  });

  it("renders a not-found state for a PRODUCT_NOT_FOUND response", async () => {
    server.use(
      http.get(`${API_URL}/api/products/does-not-exist`, () =>
        HttpResponse.json(
          { success: false, code: "PRODUCT_NOT_FOUND", message: "Product not found" },
          { status: 404 },
        ),
      ),
    );

    const { makeStore } = await import("@/store/store");
    const { ProductDetailContent } = await import("@/features/productDetail/ProductDetailContent");
    render(
      <Provider store={makeStore()}>
        <ProductDetailContent slug="does-not-exist" />
      </Provider>,
    );

    expect(
      await screen.findByText("This product doesn't exist or is no longer available."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong loading this product.")).not.toBeInTheDocument();
  });
});
