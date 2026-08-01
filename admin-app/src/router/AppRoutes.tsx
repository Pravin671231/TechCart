import { Route, Routes } from "react-router";
import { AdminShell } from "@/layout/AdminShell";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";
import { ProductFormPage } from "@/features/product-catalog/product-form/ProductFormPage";
import { CategoriesPage } from "@/features/product-catalog/categories/CategoriesPage";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import { SpecificationsPlaceholder } from "@/features/product-catalog/specifications/SpecificationsPlaceholder";
import { VariantTypesPlaceholder } from "@/features/product-catalog/variant-types/VariantTypesPlaceholder";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/product-catalog">
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="specifications" element={<SpecificationsPlaceholder />} />
          <Route path="variant-types" element={<VariantTypesPlaceholder />} />
        </Route>
      </Route>
    </Routes>
  );
}
