import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";
import { ProductFormPage } from "@/features/product-catalog/product-form/ProductFormPage";

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

  it("changes a row's status via its dropdown", async () => {
    renderProductsPage();

    await screen.findByText("Aurora X12 Smartphone");

    const statusSelects = screen.getAllByRole("combobox");
    const firstRowStatus = statusSelects[0];
    expect(firstRowStatus).toHaveTextContent("Published");

    fireEvent.mouseDown(firstRowStatus);
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Draft"));

    expect(firstRowStatus).toHaveTextContent("Draft");
  });

  it("navigates to the Add Product page when its button is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/product-catalog/products"]}>
        <Routes>
          <Route path="/product-catalog/products" element={<ProductsPage />} />
          <Route path="/product-catalog/products/new" element={<ProductFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Product/i }));

    expect(screen.getByRole("heading", { level: 1, name: "Add Product" })).toBeInTheDocument();
  });
});
