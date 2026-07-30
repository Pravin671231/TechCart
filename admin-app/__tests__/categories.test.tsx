import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CategoriesPage } from "@/features/product-catalog/categories/CategoriesPage";
import { mockCategories } from "@/features/product-catalog/categories/mockCategories";

describe("CategoriesPage", () => {
  it("renders the page header and one row per mock category, with subcategories indented", async () => {
    render(
      <MemoryRouter>
        <CategoriesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Category/i })).toBeInTheDocument();

    expect(await screen.findByText(/↳ Smartphones/)).toBeInTheDocument();

    for (const category of mockCategories) {
      expect(screen.getAllByText(new RegExp(category.name)).length).toBeGreaterThan(0);
    }
  });
});
