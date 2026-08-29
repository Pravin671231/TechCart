import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function category(id: string, name: string, slug: string, parentCategory: string | null) {
  return { _id: id, name, slug, parentCategory, sortOrder: 0, metaTitle: name, metaDescription: name };
}

async function renderMenu() {
  const { makeStore } = await import("@/store/store");
  const { CategoriesMenu } = await import("@/components/layout/CategoriesMenu");
  render(
    <Provider store={makeStore()}>
      <CategoriesMenu />
    </Provider>,
  );
}

describe("Header CategoriesMenu (Issue #322)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only parent categories on open", async () => {
    server.use(
      http.get(`${API_URL}/api/categories`, () =>
        HttpResponse.json({
          success: true,
          data: [
            category("root1", "Electronics", "electronics", null),
            category("child1", "Phones", "phones", "root1"),
            category("child2", "Laptops", "laptops", "root1"),
            category("root2", "Home", "home", null),
          ],
        }),
      ),
    );

    await renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /all categories/i }));

    expect(screen.getByRole("menuitem", { name: "Electronics" })).toHaveAttribute(
      "href",
      "/category/electronics",
    );
    expect(screen.getByRole("menuitem", { name: "Home" })).toHaveAttribute("href", "/category/home");

    // Subcategories are not listed in the header dropdown.
    expect(screen.queryByRole("menuitem", { name: "Phones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Laptops" })).not.toBeInTheDocument();
  });

  it("shows no panel when the category list is empty", async () => {
    await renderMenu();
    await userEvent.click(screen.getByRole("button", { name: /all categories/i }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
