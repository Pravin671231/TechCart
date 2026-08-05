import { BrowserRouter, Route, Routes } from "react-router";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { BrandsPage } from "@/features/brands/BrandsPage";

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AdminKeyGate>
          <Routes>
            <Route path="/" element={<LandingPlaceholder />} />
            <Route path="/brands" element={<BrandsPage />} />
          </Routes>
        </AdminKeyGate>
      </BrowserRouter>
    </Provider>
  );
}
