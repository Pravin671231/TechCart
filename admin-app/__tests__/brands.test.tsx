import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import { mockBrands } from "@/features/product-catalog/brands/mockBrands";

describe("BrandsPage", () => {
  it("renders the page header and one row per mock brand", async () => {
    render(
      <MemoryRouter>
        <BrandsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Brands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Brand/i })).toBeInTheDocument();

    expect(await screen.findByText("Brand A")).toBeInTheDocument();
    for (const brand of mockBrands) {
      expect(screen.getByText(brand.name)).toBeInTheDocument();
    }
  });
});
