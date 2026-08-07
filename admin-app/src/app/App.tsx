import { BrowserRouter, Route, Routes } from "react-router";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { BrandsPage } from "@/features/product-catalog/brands/BrandsPage";
import { CategoriesPage } from "@/features/product-catalog/categories/CategoriesPage";
import { CategorySpecificationsPage } from "@/features/product-catalog/categorySpecifications/CategorySpecificationsPage";
import { CategoryVariantsPage } from "@/features/product-catalog/categoryVariants/CategoryVariantsPage";
import { ProductsPage } from "@/features/product-catalog/products/ProductsPage";
import { ProductDetailPage } from "@/features/product-catalog/products/ProductDetailPage";
import { ProductFormPage } from "@/features/product-catalog/products/productForm/ProductFormPage";

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AdminKeyGate>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<LandingPlaceholder />} />
              <Route path="/brands" element={<BrandsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/specifications" element={<CategorySpecificationsPage />} />
              <Route path="/variant-types" element={<CategoryVariantsPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
            </Route>
          </Routes>
        </AdminKeyGate>
      </BrowserRouter>
    </Provider>
  );
}
