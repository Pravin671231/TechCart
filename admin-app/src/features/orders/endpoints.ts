export const ORDERS_ENDPOINTS = {
  list: "/orders",
  detail: (id: string) => `/orders/${id}`,
  status: (id: string) => `/orders/${id}/status`,
  cancel: (id: string) => `/orders/${id}/cancel`,
  refund: (id: string) => `/orders/${id}/refund`,
} as const;
