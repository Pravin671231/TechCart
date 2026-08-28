// Order types are canonically owned by src/features/orders/types.ts (#162) —
// checkout (#161) shipped first and defined them locally, then re-exports
// from there once orders/ existed, since both features render the identical
// order shape and orders/ is the natural resource owner.
export type {
  OrderItemView,
  OrderShippingAddress,
  OrderStatus,
  OrderResponse,
  DroppedItem,
  CheckoutResponse,
} from "@/features/orders/types";
