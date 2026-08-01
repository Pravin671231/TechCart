import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ProductFormPage } from "@/features/product-catalog/product-form/ProductFormPage";

function renderProductFormPage() {
  render(
    <MemoryRouter initialEntries={["/product-catalog/products/new"]}>
      <Routes>
        <Route path="/product-catalog/products/new" element={<ProductFormPage />} />
        <Route path="/product-catalog/products" element={<div>Products list stub</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProductFormPage", () => {
  it("renders the header, quick-nav, and bottom bar", () => {
    renderProductFormPage();

    expect(screen.getByText("Ecommerce")).toBeInTheDocument();
    expect(screen.getByText("All Product")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Add Product" })).toBeInTheDocument();
    expect(screen.getByText("Add product properly with our easy to add flow")).toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Quick Navigation" });
    for (const label of [
      "Product Information",
      "Upload Media",
      "Pricing & Inventory",
      "Specifications",
      "Variants",
      "SEO",
    ]) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText(/Product completion/)).toBeInTheDocument();
    expect(screen.getByText("17%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save as Draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go Next" })).toBeInTheDocument();
  });

  it("switches steps via the quick-nav without validation", () => {
    renderProductFormPage();

    fireEvent.click(screen.getByRole("button", { name: "Upload Media" }));

    expect(screen.getByText(/Drop your image here or/)).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("blocks Go Next when required fields are empty, and shows a field error", () => {
    renderProductFormPage();

    fireEvent.click(screen.getByRole("button", { name: "Go Next" }));

    expect(screen.getByRole("heading", { level: 1, name: "Add Product" })).toBeInTheDocument();
    expect(screen.queryByText(/Drop your image here or/)).not.toBeInTheDocument();
  });

  it("advances to Upload Media once required fields on step 1 are filled", async () => {
    renderProductFormPage();

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Aurora X12 Smartphone" } });
    fireEvent.change(screen.getByLabelText(/SKU/), { target: { value: "TC-SP-0001" } });
    fireEvent.change(screen.getByLabelText(/Brand/), { target: { value: "Brand A" } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "A great phone." } });

    fireEvent.click(screen.getByRole("button", { name: "Go Next" }));

    expect(await screen.findByText(/Drop your image here or/)).toBeInTheDocument();
  });

  it("computes the read-only selling price from MRP and discount", () => {
    renderProductFormPage();

    fireEvent.click(screen.getByRole("button", { name: "Pricing & Inventory" }));

    fireEvent.change(screen.getByLabelText(/MRP/), { target: { value: "49900" } });
    fireEvent.change(screen.getByLabelText(/Discount/), { target: { value: "10" } });

    expect(screen.getByLabelText(/Selling price/)).toHaveValue("₹44,910");
  });

  it("navigates to the products list on Cancel", () => {
    renderProductFormPage();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Products list stub")).toBeInTheDocument();
  });

  it("navigates to the products list on Save as Draft", () => {
    renderProductFormPage();

    fireEvent.click(screen.getByRole("button", { name: "Save as Draft" }));

    expect(screen.getByText("Products list stub")).toBeInTheDocument();
  });
});
