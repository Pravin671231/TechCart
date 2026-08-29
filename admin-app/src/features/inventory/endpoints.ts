export const INVENTORY_ENDPOINTS = {
  warehouses: "/warehouses",
  inventory: "/inventory",
  inventoryDetail: (id: string) => `/inventory/${id}`,
} as const;
