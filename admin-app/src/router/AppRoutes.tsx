import { Route, Routes } from "react-router";
import { AdminShell } from "@/layout/AdminShell";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { ProductsPlaceholder } from "@/features/products/ProductsPlaceholder";
import { CategoriesPlaceholder } from "@/features/categories/CategoriesPlaceholder";
import { BrandsPlaceholder } from "@/features/brands/BrandsPlaceholder";
import { SpecificationsPlaceholder } from "@/features/specifications/SpecificationsPlaceholder";
import { VariantTypesPlaceholder } from "@/features/variant-types/VariantTypesPlaceholder";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<ProductsPlaceholder />} />
        <Route path="/categories" element={<CategoriesPlaceholder />} />
        <Route path="/brands" element={<BrandsPlaceholder />} />
        <Route path="/specifications" element={<SpecificationsPlaceholder />} />
        <Route path="/variant-types" element={<VariantTypesPlaceholder />} />
      </Route>
    </Routes>
  );
}
