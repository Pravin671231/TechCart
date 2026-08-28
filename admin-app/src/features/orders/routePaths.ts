export const ORDERS_ROUTES = {
  list: "/orders",
  detailPattern: "/orders/:id",
  detail: (id: string) => `/orders/${id}`,
} as const;
