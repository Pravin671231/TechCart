import { Route } from "react-router";
import { OrdersPage } from "./OrdersPage";
import { OrderDetailPage } from "./OrderDetailPage";
import { ORDERS_ROUTES } from "./routePaths";

// Role-gating happens one level up, in mainRoutes.tsx (RequireRole
// role={["order-manager","super-admin"]} wraps this fragment's own
// AppShell mount) — matches ProductCatalogRoutes' own shape, which is
// likewise role-agnostic at this layer.
export const OrdersRoutes = () => {
  return (
    <>
      <Route path={ORDERS_ROUTES.list} element={<OrdersPage />} />
      <Route path={ORDERS_ROUTES.detailPattern} element={<OrderDetailPage />} />
    </>
  );
};
