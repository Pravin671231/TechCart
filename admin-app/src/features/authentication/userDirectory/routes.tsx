import { Route } from "react-router";
import { UserDirectoryPage } from "./UserDirectoryPage";
import { UserDirectoryDetail } from "./UserDirectoryDetail";
import { USER_DIRECTORY_ROUTES } from "./routePaths";

// Role-gating happens one level up, in mainRoutes.tsx (the same
// RequireRole role="super-admin" block AdminUsersPage already sits in) —
// matches orders/routes.tsx's own shape.
export const UserDirectoryRoutes = () => {
  return (
    <>
      <Route path={USER_DIRECTORY_ROUTES.list} element={<UserDirectoryPage />} />
      <Route path={USER_DIRECTORY_ROUTES.detailPattern} element={<UserDirectoryDetail />} />
    </>
  );
};
