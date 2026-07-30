import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";

function renderProductsPage() {
  render(
    <MemoryRouter>
      <ProductsPage />
    </MemoryRouter>,
  );
}

describe("ProductsPage", () => {
  it("renders the page header, then the table once loading resolves", async () => {
    renderProductsPage();

    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Product Catalog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Product/i })).toBeInTheDocument();

    expect(await screen.findByText("Aurora X12 Smartphone")).toBeInTheDocument();
    expect(screen.getByText("Nova Lite Smartphone")).toBeInTheDocument();
    expect(screen.getByText("ProBook 14 Laptop")).toBeInTheDocument();
  });

  it("filters to low-stock products only", async () => {
    renderProductsPage();

    await screen.findByText("Aurora X12 Smartphone");

    fireEvent.click(screen.getByRole("checkbox", { name: /Low stock only/i }));

    expect(screen.getByText("Nova Lite Smartphone")).toBeInTheDocument();
    expect(screen.queryByText("Aurora X12 Smartphone")).not.toBeInTheDocument();
  });
});
