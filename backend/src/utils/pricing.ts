// Shared by products (#31) and variants (#32) — FR-CAT-087's formula is
// exercised identically by both, so it lives here rather than inside either
// module. Pure function, no I/O.
export function computeSellingPrice(mrp: number, discount: number): number {
  return mrp - Math.floor((mrp * discount) / 100);
}
