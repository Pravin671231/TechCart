import { Types } from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "@/modules/orders/orders.repository";
import type { PaymentRecord } from "../payments.repository";

vi.mock("../payments.repository", () => ({
  create: vi.fn(),
  findLatestByOrder: vi.fn(),
  findByRazorpayOrderId: vi.fn(),
  markCaptured: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock("@/modules/orders/orders.repository", () => ({
  findOwned: vi.fn(),
}));

vi.mock("@/modules/orders/orders.service", () => ({
  markOrderPaid: vi.fn(),
  buildOrderResponse: vi.fn(),
}));

vi.mock("@/externalService/razorpay", () => ({
  createRazorpayOrder: vi.fn(),
  verifyPaymentSignature: vi.fn(),
}));

import { findOwned } from "@/modules/orders/orders.repository";
import { buildOrderResponse, markOrderPaid } from "@/modules/orders/orders.service";
import { createRazorpayOrder, verifyPaymentSignature } from "@/externalService/razorpay";
import * as paymentsRepository from "../payments.repository";
import { initiatePayment, verifyPayment } from "../payments.service";

const userId = new Types.ObjectId().toString();
const orderId = new Types.ObjectId().toString();

function makeOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    _id: new Types.ObjectId(orderId),
    orderNumber: "TC-2026-000001",
    user: new Types.ObjectId(userId),
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

function makePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    _id: new Types.ObjectId(),
    order: new Types.ObjectId(orderId),
    razorpayOrderId: "order_existing",
    amount: 150000,
    currency: "INR",
    status: "created",
    refunds: [],
    webhookEvents: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PaymentRecord;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("initiatePayment / FR-PAY-001-004", () => {
  it("throws ORDER_NOT_FOUND for a non-owned or nonexistent order", async () => {
    vi.mocked(findOwned).mockResolvedValue(null);

    await expect(initiatePayment(userId, orderId)).rejects.toMatchObject({
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
    });
  });

  it("throws PAYMENT_NOT_ALLOWED when the order isn't pending_payment", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder({ status: "paid" }));

    await expect(initiatePayment(userId, orderId)).rejects.toMatchObject({
      statusCode: 400,
      code: "PAYMENT_NOT_ALLOWED",
    });
  });

  it("mints a Razorpay order in integer paise and persists a new payment attempt", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder({ totalAmount: 1500 }));
    vi.mocked(paymentsRepository.findLatestByOrder).mockResolvedValue(null);
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      id: "order_new",
      amount: 150000,
      currency: "INR",
      status: "created",
    });
    vi.mocked(paymentsRepository.create).mockResolvedValue(
      makePayment({ razorpayOrderId: "order_new", amount: 150000 }),
    );

    const result = await initiatePayment(userId, orderId);

    expect(createRazorpayOrder).toHaveBeenCalledWith(150000, "INR", "TC-2026-000001");
    expect(paymentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 150000, status: "created" }),
    );
    expect(result).toMatchObject({ razorpayOrderId: "order_new", amount: 150000, currency: "INR" });
    expect(result.keyId).toEqual(expect.any(String));
  });

  it("is idempotent — reuses an existing non-failed attempt instead of minting a new Razorpay order", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder());
    vi.mocked(paymentsRepository.findLatestByOrder).mockResolvedValue(
      makePayment({ status: "created", razorpayOrderId: "order_existing" }),
    );

    const result = await initiatePayment(userId, orderId);

    expect(createRazorpayOrder).not.toHaveBeenCalled();
    expect(paymentsRepository.create).not.toHaveBeenCalled();
    expect(result.razorpayOrderId).toBe("order_existing");
  });

  it("mints a fresh Razorpay order when the latest attempt failed (retry, FR-PAY-011)", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder());
    vi.mocked(paymentsRepository.findLatestByOrder).mockResolvedValue(
      makePayment({ status: "failed", razorpayOrderId: "order_failed" }),
    );
    vi.mocked(createRazorpayOrder).mockResolvedValue({
      id: "order_retry",
      amount: 150000,
      currency: "INR",
      status: "created",
    });
    vi.mocked(paymentsRepository.create).mockResolvedValue(
      makePayment({ razorpayOrderId: "order_retry" }),
    );

    const result = await initiatePayment(userId, orderId);

    expect(createRazorpayOrder).toHaveBeenCalled();
    expect(result.razorpayOrderId).toBe("order_retry");
  });
});

describe("verifyPayment / FR-PAY-005-011", () => {
  const verifyInput = {
    razorpayOrderId: "order_existing",
    razorpayPaymentId: "pay_123",
    razorpaySignature: "sig_123",
  };

  it("throws ORDER_NOT_FOUND for a non-owned or nonexistent order", async () => {
    vi.mocked(findOwned).mockResolvedValue(null);

    await expect(verifyPayment(userId, orderId, verifyInput)).rejects.toMatchObject({
      statusCode: 404,
      code: "ORDER_NOT_FOUND",
    });
  });

  it("throws PAYMENT_NOT_FOUND when no payment matches the given razorpayOrderId for this order", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder());
    vi.mocked(paymentsRepository.findByRazorpayOrderId).mockResolvedValue(null);

    await expect(verifyPayment(userId, orderId, verifyInput)).rejects.toMatchObject({
      statusCode: 404,
      code: "PAYMENT_NOT_FOUND",
    });
  });

  it("on a valid signature: marks the payment captured and the order paid", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder());
    vi.mocked(paymentsRepository.findByRazorpayOrderId).mockResolvedValue(makePayment());
    vi.mocked(verifyPaymentSignature).mockReturnValue(true);
    vi.mocked(markOrderPaid).mockResolvedValue(makeOrder({ status: "paid" }));
    vi.mocked(buildOrderResponse).mockReturnValue({ id: orderId, status: "paid" } as never);

    const result = await verifyPayment(userId, orderId, verifyInput);

    expect(paymentsRepository.markCaptured).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ razorpayPaymentId: "pay_123", razorpaySignature: "sig_123" }),
    );
    expect(markOrderPaid).toHaveBeenCalledWith(expect.anything(), "pay_123");
    expect(paymentsRepository.markFailed).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "paid" });
  });

  it("on an invalid signature: marks the payment failed and leaves the order untouched", async () => {
    vi.mocked(findOwned).mockResolvedValue(makeOrder());
    vi.mocked(paymentsRepository.findByRazorpayOrderId).mockResolvedValue(makePayment());
    vi.mocked(verifyPaymentSignature).mockReturnValue(false);

    await expect(verifyPayment(userId, orderId, verifyInput)).rejects.toMatchObject({
      statusCode: 400,
      code: "PAYMENT_VERIFICATION_FAILED",
    });

    expect(paymentsRepository.markFailed).toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
});
