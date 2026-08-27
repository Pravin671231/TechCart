// Mirrors backend's CartResponse (cart.service.ts, SRS v0.4 §5). Pricing and
// availability are always resolved live server-side — never stored, never
// computed here from raw catalog data.

export type CartVariantView = {
  id: string;
  sku: string;
  product: { id: string; name: string; slug: string };
  attributes: { name: string; value: string }[];
  primaryImage: { url: string; alt?: string } | null;
};

export type CartLineItem = {
  variant: CartVariantView;
  quantity: number;
  sellingPrice: number;
  lineTotal: number;
  // A variant that's been deactivated, whose product is unpublished, or whose
  // quantity now exceeds the per-variant cap — kept visible so the buyer sees
  // why their total changed, excluded from `subtotal`, still counted in
  // `itemCount` (FR-CART-012/013/017).
  unavailable: boolean;
};

export type Cart = {
  id?: string;
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
};
