import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "../orders.repository";

vi.mock("../orders.repository", () => ({
  findById: vi.fn(),
  updateStatus: vi.fn(),
  findBuyerIdentity: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/externalService/mailer", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
}));

import { findById, updateStatus } from "../orders.repository";
import { markOrderPaid } from "../orders.service";

const orderId = new Types.ObjectId();

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    _id: orderId,
    orderNumber: "TC-2026-000001",
    user: new Types.ObjectId(),
    items: [],
    shippingAddress: {
      fullName: "Asha Rao",
      phone: "9876543210",
      line1: "221B, Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560025",
    },
    totalAmount: 1500,
    status: "pending_payment",
    statusHistory: [{ status: "pending_payment", at: new Date() }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as OrderRecord;
}

afterEach(() => {
  vi.clearAllMocks();
});

// Bug fix, no issue number — a webhook delivery (payment.captured) and
// verifyPayment's client-side callback can both resolve for the same
// payment; whichever calls markOrderPaid second used to throw
// INVALID_ORDER_TRANSITION ("paid" -> "paid" has no edge in the state
// machine). markOrderPaid now recovers from exactly this race.
describe("markOrderPaid", () => {
  it("recovers from a concurrent paid->paid race and returns the current order", async () => {
    // First call: transitionOrder's own read sees the order already paid
    // (the other caller won the race) and assertTransition throws before
    // updateStatus is ever called. Second call: markOrderPaid's recovery
    // re-fetch confirms it's paid and returns it.
    vi.mocked(findById).mockResolvedValueOnce(makeOrder({ status: "paid" }));
    vi.mocked(findById).mockResolvedValueOnce(makeOrder({ status: "paid" }));

    const result = await markOrderPaid(orderId, "pay_123");

    expect(result.status).toBe("paid");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(findById).toHaveBeenCalledTimes(2);
  });

  it("re-throws INVALID_ORDER_TRANSITION when the order still isn't paid after recovery", async () => {
    // "cancelled" has no outgoing edges at all (ORDER_TRANSITIONS.cancelled
    // is []) — a genuinely illegal move, not a race.
    vi.mocked(findById).mockResolvedValueOnce(makeOrder({ status: "cancelled" }));
    vi.mocked(findById).mockResolvedValueOnce(makeOrder({ status: "cancelled" }));

    await expect(markOrderPaid(orderId, "pay_123")).rejects.toMatchObject({
      statusCode: 409,
      code: "INVALID_ORDER_TRANSITION",
    });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("on the normal, non-racing path: transitions pending_payment to paid directly", async () => {
    vi.mocked(findById).mockResolvedValueOnce(makeOrder({ status: "pending_payment" }));
    vi.mocked(updateStatus).mockResolvedValueOnce(makeOrder({ status: "paid" }));

    const result = await markOrderPaid(orderId, "pay_123");

    expect(result.status).toBe("paid");
    expect(updateStatus).toHaveBeenCalledTimes(1);
    // Not asserting findById's exact call count here — enqueueStatusNotification's
    // own fire-and-forget email job (transitionOrder always fires one for a
    // notifiable status like "paid") makes its own independent findById call
    // in the background, unrelated to markOrderPaid's recovery path.
  });
});
