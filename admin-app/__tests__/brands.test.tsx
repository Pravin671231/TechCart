import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the page header and one row per mock brand", () => {
    renderBrandsPage();

    expect(screen.getByRole("heading", { level: 1, name: "Brands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Brand/i })).toBeInTheDocument();

    for (const brand of mockBrands) {
      expect(screen.getByText(brand.name)).toBeInTheDocument();
    }
  });

  it("filters by search", () => {
    renderBrandsPage();

    fireEvent.change(screen.getByPlaceholderText("Search by name..."), {
      target: { value: "Brand A" },
    });

    expect(screen.getByText("Brand A")).toBeInTheDocument();
    expect(screen.queryByText("Brand B")).not.toBeInTheDocument();
  });
});
