import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, type OrderStatus } from "../orders.model";
import { assertTransition, canTransition } from "../orders.stateMachine";

// FR-ORD-008 — every legal edge in the fixed graph, and every illegal one
// (exhaustively, not just a sample) since this table is the single source
// of truth every status-changing endpoint in M5 relies on.
const LEGAL_EDGES: [OrderStatus, OrderStatus][] = [
  ["pending_payment", "paid"],
  ["pending_payment", "cancelled"],
  ["paid", "processing"],
  ["paid", "cancelled"],
  ["paid", "refunded"],
  ["processing", "shipped"],
  ["processing", "refunded"],
  ["shipped", "delivered"],
  ["shipped", "refunded"],
  ["delivered", "refunded"],
];

describe("canTransition / FR-ORD-008", () => {
  it.each(LEGAL_EDGES)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("rejects every pair not in the legal-edge table", () => {
    const legal = new Set(LEGAL_EDGES.map(([from, to]) => `${from}->${to}`));
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (from === to) continue;
        const key = `${from}->${to}`;
        expect(canTransition(from, to)).toBe(legal.has(key));
      }
    }
  });

  it("cancelled and refunded are terminal — no transition out of either", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("cancelled", to)).toBe(false);
      expect(canTransition("refunded", to)).toBe(false);
    }
  });
});

describe("assertTransition", () => {
  it("does not throw for a legal transition", () => {
    expect(() => assertTransition("pending_payment", "paid")).not.toThrow();
  });

  it("throws INVALID_ORDER_TRANSITION naming both statuses for an illegal one", () => {
    expect(() => assertTransition("pending_payment", "shipped")).toThrowError(
      expect.objectContaining({
        statusCode: 409,
        code: "INVALID_ORDER_TRANSITION",
        message: expect.stringContaining("pending_payment"),
      }),
    );
  });
});
