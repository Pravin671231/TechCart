import { BrowserRouter, Route, Routes } from "react-router";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { BrandsPage } from "@/features/brands/BrandsPage";
import { CategoriesPage } from "@/features/categories/CategoriesPage";
import { CategorySpecificationsPage } from "@/features/categorySpecifications/CategorySpecificationsPage";
import { CategoryVariantsPage } from "@/features/categoryVariants/CategoryVariantsPage";

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
          </Routes>
        </AdminKeyGate>
      </BrowserRouter>
    </Provider>
  );
}
