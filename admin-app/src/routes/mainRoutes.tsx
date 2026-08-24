import { Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { ProductCatalogRoutes } from "@/features/product-catalog/routes";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SignInContent } from "@/features/auth/SignInContent";

export const MainRoutes = () => {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInContent />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<LandingPlaceholder />} />
          {ProductCatalogRoutes()}
        </Route>
      </Route>
    </Routes>
  );
};
