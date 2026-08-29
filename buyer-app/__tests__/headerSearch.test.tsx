import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

async function renderSearchBar() {
  const { makeStore } = await import("@/store/store");
  const { SearchBar } = await import("@/components/layout/SearchBar");
  render(
    <Provider store={makeStore()}>
      <SearchBar />
    </Provider>,
  );
}

describe("Header SearchBar (Issue #322)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("navigates to /search?q= on submit", async () => {
    await renderSearchBar();

    const input = screen.getByRole("searchbox", { name: /search/i });
    await userEvent.type(input, "phone{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/search?q=phone");
  });

  it("shows product and category suggestions once at least 2 characters are typed", async () => {
    server.use(
      http.get(`${API_URL}/api/products`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              _id: "p1",
              name: "Pixel Phone",
              slug: "pixel-phone",
              brand: { _id: "b1", name: "Pixel", slug: "pixel" },
              mrp: 50000,
              discount: 0,
              sellingPrice: 50000,
              isFeatured: false,
              cardSpecifications: [],
            },
          ],
          pagination: { page: 1, limit: 5, total: 1, totalPages: 1, hasNextPage: false },
        }),
      ),
      http.get(`${API_URL}/api/categories/search`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              _id: "c1",
              name: "Phones",
              slug: "phones",
              parentCategory: null,
              sortOrder: 0,
              metaTitle: "Phones",
              metaDescription: "Phones",
            },
          ],
        }),
      ),
    );

    await renderSearchBar();
    await userEvent.type(screen.getByRole("searchbox", { name: /search/i }), "pho");

    const categoryLink = await screen.findByRole("link", { name: "Phones" });
    expect(categoryLink).toHaveAttribute("href", "/category/phones");

    const productLink = await screen.findByRole("link", { name: "Pixel Phone" });
    expect(productLink).toHaveAttribute("href", "/products/pixel-phone");

    expect(screen.getByRole("button", { name: /see all results/i })).toBeInTheDocument();
  });
});
