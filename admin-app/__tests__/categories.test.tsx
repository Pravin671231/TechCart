import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CategoriesPage } from "@/features/product-catalog/categories/CategoriesPage";
import { mockCategories } from "@/features/product-catalog/categories/mockCategories";

function renderCategoriesPage() {
  render(
    <MemoryRouter>
      <CategoriesPage />
    </MemoryRouter>,
  );
}

describe("CategoriesPage", () => {
  it("renders the page header and one row per mock category", () => {
    renderCategoriesPage();

    expect(screen.getByRole("heading", { level: 1, name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Category/i })).toBeInTheDocument();

    for (const category of mockCategories) {
      expect(screen.getAllByText(new RegExp(category.name)).length).toBeGreaterThan(0);
    }
  });

  it("filters by search", () => {
    renderCategoriesPage();

    fireEvent.change(screen.getByPlaceholderText("Search by name..."), {
      target: { value: "Laptops" },
    });

    expect(screen.getByText(/Laptops/)).toBeInTheDocument();
    expect(screen.queryByText(/Accessories/)).not.toBeInTheDocument();
  });
});
