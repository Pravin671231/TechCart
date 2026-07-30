import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("renders the page header and one row per mock category, with subcategories indented", async () => {
    renderCategoriesPage();

    expect(screen.getByRole("heading", { level: 1, name: "Categories" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Category/i })).toBeInTheDocument();

    expect(await screen.findByText(/↳ Smartphones/)).toBeInTheDocument();

    for (const category of mockCategories) {
      expect(screen.getAllByText(new RegExp(category.name)).length).toBeGreaterThan(0);
    }
  });

  it("changes a row's status via its dropdown", async () => {
    renderCategoriesPage();

    await screen.findByText(/↳ Smartphones/);

    const statusSelects = screen.getAllByRole("combobox");
    const firstRowStatus = statusSelects[0];
    expect(firstRowStatus).toHaveTextContent("Active");

    fireEvent.mouseDown(firstRowStatus);
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Inactive"));

    expect(firstRowStatus).toHaveTextContent("Inactive");
  });
});
