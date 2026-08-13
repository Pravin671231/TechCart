import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { server } from "../../../mocks/server";
import { renderWithStore } from "../../../utils/renderWithStore";
import { CategoriesPage } from "@/features/product-catalog/categories/CategoriesPage";
import type { CategoryListItem } from "@/features/product-catalog/categories/types";

const BASE = "http://localhost:4000/api/admin";

function makeCategory(overrides: Partial<CategoryListItem> = {}): CategoryListItem {
  return {
    _id: "cat-1",
    name: "Electronics",
    slug: "electronics",
    parentCategory: null,
    sortOrder: 1,
    status: true,
    productCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setupCategoryHandlers(
  initial: CategoryListItem[],
  options: { updateError?: { status: number; code: string; message: string } } = {},
) {
  let categories = initial;

  server.use(
    http.get(`${BASE}/categories`, ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const filtered = search
        ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
        : categories;
      return HttpResponse.json({ success: true, data: filtered });
    }),
    http.post(`${BASE}/categories`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const newCategory = makeCategory({
        _id: `cat-${categories.length + 1}`,
        name: body.name as string,
        slug: (body.name as string).toLowerCase().replace(/\s+/g, "-"),
        parentCategory: (body.parentCategory as string | undefined) ?? null,
        sortOrder: (body.sortOrder as number | undefined) ?? 0,
      });
      categories = [...categories, newCategory];
      return HttpResponse.json({ success: true, data: newCategory }, { status: 201 });
    }),
    http.patch(`${BASE}/categories/:id`, async ({ params, request }) => {
      if (options.updateError) {
        return HttpResponse.json(
          { success: false, code: options.updateError.code, message: options.updateError.message },
          { status: options.updateError.status },
        );
      }
      const body = (await request.json()) as Record<string, unknown>;
      categories = categories.map((c) => (c._id === params.id ? { ...c, ...body } : c));
      const updated = categories.find((c) => c._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
    http.patch(`${BASE}/categories/:id/status`, async ({ params, request }) => {
      const body = (await request.json()) as { status: boolean };
      categories = categories.map((c) => (c._id === params.id ? { ...c, status: body.status } : c));
      const updated = categories.find((c) => c._id === params.id);
      return HttpResponse.json({ success: true, data: updated });
    }),
    http.delete(`${BASE}/categories/:id`, ({ params }) => {
      const target = categories.find((c) => c._id === params.id);
      const subcategoryCount = categories.filter((c) => c.parentCategory === params.id).length;
      const reasons: string[] = [];
      if (target && target.productCount > 0) reasons.push(`${target.productCount} product(s)`);
      if (subcategoryCount > 0) reasons.push(`${subcategoryCount} subcategory(ies)`);
      if (reasons.length > 0) {
        return HttpResponse.json(
          {
            success: false,
            code: "CATEGORY_IN_USE",
            message: `Cannot delete category: referenced by ${reasons.join(" and ")}.`,
          },
          { status: 409 },
        );
      }
      categories = categories.filter((c) => c._id !== params.id);
      return HttpResponse.json({ success: true, data: null });
    }),
  );
}

describe("CategoriesPage", () => {
  it("renders the two-level category tree with parent/child rows", async () => {
    setupCategoryHandlers([
      makeCategory({ _id: "cat-1", name: "Electronics", sortOrder: 1 }),
      makeCategory({ _id: "cat-2", name: "Smartphones", parentCategory: "cat-1", sortOrder: 1 }),
    ]);

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });

    await screen.findByText("↳ Smartphones");

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Electronics")).toBeInTheDocument();
    expect(within(rows[1]).getByText("↳ Smartphones")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Electronics")).toBeInTheDocument();
  });

  it("creates a new root category", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics" })]);

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByRole("button", { name: "+ New category" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Furniture" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Furniture")).toBeInTheDocument();
  });

  it("shows a distinct inline error for INVALID_PARENT_CATEGORY", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics" })], {
      updateError: {
        status: 400,
        code: "INVALID_PARENT_CATEGORY",
        message: "A category cannot be its own parent.",
      },
    });

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A category cannot be its own parent.");
  });

  it("shows a distinct inline error for PARENT_CATEGORY_NOT_FOUND", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics" })], {
      updateError: {
        status: 404,
        code: "PARENT_CATEGORY_NOT_FOUND",
        message: "Parent category cat-x was not found.",
      },
    });

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Parent category cat-x was not found.");
  });

  it("shows a distinct inline error for PARENT_CATEGORY_TOO_DEEP", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics" })], {
      updateError: {
        status: 400,
        code: "PARENT_CATEGORY_TOO_DEEP",
        message:
          "The selected parent category already has a parent — categories may be at most two levels deep.",
      },
    });

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The selected parent category already has a parent — categories may be at most two levels deep.",
    );
  });

  it("shows a distinct inline error for CATEGORY_HAS_SUBCATEGORIES", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics" })], {
      updateError: {
        status: 400,
        code: "CATEGORY_HAS_SUBCATEGORIES",
        message: "This category already has subcategories and cannot also be given a parent.",
      },
    });

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This category already has subcategories and cannot also be given a parent.",
    );
  });

  it("shows the combined product+subcategory delete guard in one message", async () => {
    setupCategoryHandlers([
      makeCategory({ _id: "cat-1", name: "Electronics", productCount: 1 }),
      makeCategory({ _id: "cat-2", name: "Smartphones", parentCategory: "cat-1" }),
    ]);

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("↳ Smartphones");

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/1 product\(s\) and 1 subcategory\(ies\)/)).toBeInTheDocument();
  });

  it("toggles category status", async () => {
    setupCategoryHandlers([makeCategory({ _id: "cat-1", name: "Electronics", status: true })]);

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    const statusButton = await screen.findByRole("button", { name: "Active" });

    fireEvent.click(statusButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inactive" })).toBeInTheDocument();
    });
  });

  it("filters the tree via search", async () => {
    setupCategoryHandlers([
      makeCategory({ _id: "cat-1", name: "Electronics" }),
      makeCategory({ _id: "cat-2", name: "Furniture", sortOrder: 2 }),
    ]);

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.change(screen.getByLabelText("Search categories"), { target: { value: "furn" } });

    await waitFor(() => {
      expect(screen.queryByText("Electronics")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Furniture")).toBeInTheDocument();
  });

  it("debounces rapid search keystrokes into a single request", async () => {
    setupCategoryHandlers([
      makeCategory({ _id: "cat-1", name: "Electronics" }),
      makeCategory({ _id: "cat-2", name: "Furniture", sortOrder: 2 }),
    ]);
    const requestedSearches: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/categories`, ({ request }) => {
        const url = new URL(request.url);
        requestedSearches.push(url.searchParams.get("search"));
        return HttpResponse.json({ success: true, data: [] });
      }),
    );

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await waitFor(() => expect(requestedSearches.length).toBeGreaterThan(0));
    const requestsBeforeTyping = requestedSearches.length;

    const searchInput = screen.getByLabelText("Search categories");
    fireEvent.change(searchInput, { target: { value: "f" } });
    fireEvent.change(searchInput, { target: { value: "fu" } });
    fireEvent.change(searchInput, { target: { value: "fur" } });

    await waitFor(() => {
      expect(requestedSearches.slice(requestsBeforeTyping)).toEqual(["fur"]);
    });
  });

  it("shows an in-body indicator while a search refetch is in flight", async () => {
    setupCategoryHandlers([
      makeCategory({ _id: "cat-1", name: "Electronics" }),
      makeCategory({ _id: "cat-2", name: "Furniture", sortOrder: 2 }),
    ]);
    server.use(
      http.get(`${BASE}/categories`, async ({ request }) => {
        const url = new URL(request.url);
        const search = url.searchParams.get("search");
        if (search) await delay(50);
        const data = search
          ? [makeCategory({ _id: "cat-2", name: "Furniture", sortOrder: 2 })]
          : [
              makeCategory({ _id: "cat-1", name: "Electronics" }),
              makeCategory({ _id: "cat-2", name: "Furniture", sortOrder: 2 }),
            ];
        return HttpResponse.json({ success: true, data });
      }),
    );

    renderWithStore(<CategoriesPage />, { adminKey: "test-key" });
    await screen.findByText("Electronics");

    fireEvent.change(screen.getByLabelText("Search categories"), { target: { value: "fur" } });

    expect(await screen.findByRole("status")).toHaveTextContent("Updating…");
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
