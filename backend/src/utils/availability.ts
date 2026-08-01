export const AVAILABILITY_STATES = ["out_of_stock", "low_stock", "in_stock"] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

// FR-CAT-096: 0 -> out_of_stock; 0 < stock <= lowStockThreshold -> low_stock (inclusive
// boundary); else in_stock. Callers pass a variant's own stock alongside the *parent
// product's* lowStockThreshold — variants have no threshold field of their own.
export function deriveAvailability(stock: number, lowStockThreshold: number): Availability {
  if (stock <= 0) return "out_of_stock";
  if (stock <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

const RANK: Record<Availability, number> = { out_of_stock: 0, low_stock: 1, in_stock: 2 };

// FR-CAT-096: a product's own availability, when it has variants, is the best state
// across its active variants — in_stock beats low_stock beats out_of_stock. An empty
// list (no active variants) has no purchasable unit at all, so it reports out_of_stock.
export function bestAvailability(states: Availability[]): Availability {
  return states.reduce<Availability>(
    (best, state) => (RANK[state] > RANK[best] ? state : best),
    "out_of_stock",
  );
}
