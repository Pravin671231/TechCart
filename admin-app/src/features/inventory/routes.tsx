import { Route } from "react-router";
import { InventoryPage } from "./InventoryPage";
import { WarehousesPage } from "./WarehousesPage";
import { INVENTORY_ROUTES } from "./routePaths";

// Role-gating happens one level up, in mainRoutes.tsx — mirrors
// ProductCatalogRoutes'/OrdersRoutes' own shape, role-agnostic at this layer.
export const InventoryRoutes = () => {
  return (
    <>
      <Route path={INVENTORY_ROUTES.inventory} element={<InventoryPage />} />
      <Route path={INVENTORY_ROUTES.warehouses} element={<WarehousesPage />} />
    </>
  );
};
