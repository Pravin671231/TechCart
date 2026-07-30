import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import { mockBrands } from "@/features/product-catalog/brands/mockBrands";

function renderBrandsPage() {
  render(
    <MemoryRouter>
      <BrandsPage />
    </MemoryRouter>,
  );
}

describe("BrandsPage", () => {
  it("renders the page header and one row per mock brand", async () => {
    renderBrandsPage();

    expect(screen.getByRole("heading", { level: 1, name: "Brands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Brand/i })).toBeInTheDocument();

    expect(await screen.findByText("Brand A")).toBeInTheDocument();
    for (const brand of mockBrands) {
      expect(screen.getByText(brand.name)).toBeInTheDocument();
    }
  });

  it("changes a row's status via its dropdown", async () => {
    renderBrandsPage();

    await screen.findByText("Brand A");

    const statusSelects = screen.getAllByRole("combobox");
    const firstRowStatus = statusSelects[0];
    expect(firstRowStatus).toHaveTextContent("Active");

    fireEvent.mouseDown(firstRowStatus);
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Inactive"));

    expect(firstRowStatus).toHaveTextContent("Inactive");
  });
});
