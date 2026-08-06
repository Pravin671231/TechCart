import { BrowserRouter, Route, Routes } from "react-router";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { BrandsPage } from "@/features/brands/BrandsPage";
import { CategoriesPage } from "@/features/categories/CategoriesPage";
import { CategorySpecificationsPage } from "@/features/categorySpecifications/CategorySpecificationsPage";
import { CategoryVariantsPage } from "@/features/categoryVariants/CategoryVariantsPage";
import { ProductsPage } from "@/features/products/ProductsPage";
import { ProductDetailPage } from "@/features/products/ProductDetailPage";
import { ProductFormPage } from "@/features/products/productForm/ProductFormPage";

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AdminKeyGate>
          <Routes>
            <Route path="/" element={<LandingPlaceholder />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/specifications" element={<CategorySpecificationsPage />} />
            <Route path="/variant-types" element={<CategoryVariantsPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
          </Routes>
        </AdminKeyGate>
      </BrowserRouter>
    </Provider>
  );
}
