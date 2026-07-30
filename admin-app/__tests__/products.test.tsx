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
  it("renders the page header, first page of results, and pagination summary", () => {
    renderProductsPage();

    expect(screen.getByRole("heading", { level: 1, name: "Products" })).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Product Catalog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Product/i })).toBeInTheDocument();

    expect(screen.getByText("Aurora X12 Smartphone")).toBeInTheDocument();
    expect(screen.queryByText("USB-C Charger 20W")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–3 of 5")).toBeInTheDocument();
  });

  it("moves to the next page", () => {
    renderProductsPage();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("USB-C Charger 20W")).toBeInTheDocument();
    expect(screen.queryByText("Aurora X12 Smartphone")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 4–5 of 5")).toBeInTheDocument();
  });

  it("filters by search", () => {
    renderProductsPage();

    fireEvent.change(screen.getByPlaceholderText("Search name or SKU..."), {
      target: { value: "Aurora" },
    });

    expect(screen.getByText("Aurora X12 Smartphone")).toBeInTheDocument();
    expect(screen.queryByText("Nova Lite Smartphone")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });

  it("filters by status", () => {
    renderProductsPage();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "draft" } });

    expect(screen.getByText("ProBook 14 Laptop")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });

  it("filters by low stock only", () => {
    renderProductsPage();

    fireEvent.click(screen.getByRole("checkbox", { name: /Low stock only/i }));

    expect(screen.getByText("Nova Lite Smartphone")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1")).toBeInTheDocument();
  });
});
