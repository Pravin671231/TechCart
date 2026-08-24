import { Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LandingPlaceholder } from "@/features/landing/LandingPlaceholder";
import { ProductCatalogRoutes } from "@/features/product-catalog/routes";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { RequireRole } from "@/features/auth/RequireRole";
import { SignInContent } from "@/features/auth/SignInContent";
import { AdminUsersPage } from "@/features/adminUsers/AdminUsersPage";
import { AccountPage } from "@/features/account/AccountPage";

export const MainRoutes = () => {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInContent />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireRole role="super-admin" />}>
          <Route element={<AppShell />}>
            <Route path="/admin-users" element={<AdminUsersPage />} />
          </Route>
        </Route>
        <Route element={<AppShell />}>
          <Route path="/" element={<LandingPlaceholder />} />
          {ProductCatalogRoutes()}
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>
    </Routes>
  );
};
