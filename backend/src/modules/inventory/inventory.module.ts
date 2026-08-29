import warehousesRoutes from "./warehouses.routes";
import inventoryRoutes from "./inventory.routes";

// Two mount points, one module — the two collections (warehouses/inventory)
// have no independent lifecycle from each other, but the SRS's own API
// contract gives them two distinct URL prefixes. Both admin-only, unlike
// brands' own two-mount-point precedent (there admin+public).
export const warehousesAdminModule = {
  path: "/warehouses",
  router: warehousesRoutes,
};

export const inventoryAdminModule = {
  path: "/inventory",
  router: inventoryRoutes,
};
