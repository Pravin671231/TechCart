import { Route, Routes } from "react-router";
import { AdminShell } from "@/layout/AdminShell";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ProductsPlaceholder } from "@/features/product-catalog/products/ProductsPlaceholder";
import { CategoriesPlaceholder } from "@/features/product-catalog/categories/CategoriesPlaceholder";
import { BrandsPlaceholder } from "@/features/product-catalog/brands/BrandsPlaceholder";
import { SpecificationsPlaceholder } from "@/features/product-catalog/specifications/SpecificationsPlaceholder";
import { VariantTypesPlaceholder } from "@/features/product-catalog/variant-types/VariantTypesPlaceholder";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/product-catalog">
          <Route path="products" element={<ProductsPlaceholder />} />
          <Route path="categories" element={<CategoriesPlaceholder />} />
          <Route path="brands" element={<BrandsPlaceholder />} />
          <Route path="specifications" element={<SpecificationsPlaceholder />} />
          <Route path="variant-types" element={<VariantTypesPlaceholder />} />
        </Route>
      </Route>
    </Routes>
  );
}
