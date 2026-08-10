import { Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { ProductCatalogRoutes } from "@/features/product-catalog/routes";

export const MainRoutes = () => {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPlaceholder />} />
        {ProductCatalogRoutes()}
      </Route>
    </Routes>
  );
};
