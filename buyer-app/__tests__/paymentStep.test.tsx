import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { CheckoutResponse } from "@/features/checkout/types";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/checkout",
  useSearchParams: () => new URLSearchParams(),
}));

// next/script never actually loads a remote script in jsdom — this stub
// fires onLoad from an effect (post-commit, matching a real script tag's
// own async onload timing) so PaymentStep's post-load effect runs without
// tripping React's "setState while rendering a different component" guard.
function MockScript({ onLoad }: { onLoad?: () => void }) {
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);
  return null;
}

vi.mock("next/script", () => ({
  default: MockScript,
}));

const order: CheckoutResponse = {
  id: "order1",
  orderNumber: "TC-2026-000001",
  user: "u1",
  status: "pending_payment",
  items: [],
  shippingAddress: {
    fullName: "Asha Rao",
    phone: "9876543210",
    line1: "221B, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560025",
  },
  totalAmount: 80000,
  statusHistory: [{ status: "pending_payment", at: "2026-08-28T00:00:00.000Z" }],
  createdAt: "2026-08-28T00:00:00.000Z",
  payment: null,
};

type CapturedOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

let capturedOptions: CapturedOptions | undefined;
const openMock = vi.fn();

async function renderPaymentStep() {
  const { makeStore } = await import("@/store/store");
  const { PaymentStep } = await import("@/features/checkout/PaymentStep");
  render(
    <Provider store={makeStore()}>
      <PaymentStep order={order} />
    </Provider>,
  );
}

describe("PaymentStep", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
    openMock.mockClear();
    capturedOptions = undefined;
    // A real `function`, not an arrow — vi.fn()'s default mock implementation
    // can't be invoked with `new` (arrow functions aren't constructible at
    // all), and PaymentStep does `new window.Razorpay(...)`.
    window.Razorpay = vi.fn(function (this: unknown, options: CapturedOptions) {
      capturedOptions = options;
      return { open: openMock };
    }) as unknown as typeof window.Razorpay;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.Razorpay;
  });

  it("initiates payment on mount and opens the widget with the returned fields", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          {
            success: true,
            data: { razorpayOrderId: "order_rzp1", amount: 8000000, currency: "INR", keyId: "rzp_test_1" },
          },
          { status: 201 },
        ),
      ),
    );

    await renderPaymentStep();

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(capturedOptions).toMatchObject({
      key: "rzp_test_1",
      amount: 8000000,
      currency: "INR",
      order_id: "order_rzp1",
    });
  });

  it("verifies on the widget's success callback and redirects to the order detail page", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          {
            success: true,
            data: { razorpayOrderId: "order_rzp2", amount: 8000000, currency: "INR", keyId: "rzp_test_1" },
          },
          { status: 201 },
        ),
      ),
      http.post(`${API_URL}/api/orders/${order.id}/payment/verify`, () =>
        HttpResponse.json({ success: true, data: { ...order, status: "paid" } }),
      ),
    );

    await renderPaymentStep();
    await waitFor(() => expect(capturedOptions).toBeDefined());

    capturedOptions!.handler({
      razorpay_order_id: "order_rzp2",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig_1",
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/orders/${order.id}`));
  });

  it("shows a retry option when the widget is dismissed without completing payment", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          {
            success: true,
            data: { razorpayOrderId: "order_rzp3", amount: 8000000, currency: "INR", keyId: "rzp_test_1" },
          },
          { status: 201 },
        ),
      ),
    );

    await renderPaymentStep();
    await waitFor(() => expect(capturedOptions).toBeDefined());

    capturedOptions!.modal?.ondismiss?.();

    expect(await screen.findByRole("button", { name: /retry payment/i })).toBeInTheDocument();
  });

  it("shows a retry option and a message when server-side verification fails", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          {
            success: true,
            data: { razorpayOrderId: "order_rzp4", amount: 8000000, currency: "INR", keyId: "rzp_test_1" },
          },
          { status: 201 },
        ),
      ),
      http.post(`${API_URL}/api/orders/${order.id}/payment/verify`, () =>
        HttpResponse.json(
          { success: false, code: "PAYMENT_VERIFICATION_FAILED", message: "Signature mismatch." },
          { status: 400 },
        ),
      ),
    );

    await renderPaymentStep();
    await waitFor(() => expect(capturedOptions).toBeDefined());

    capturedOptions!.handler({
      razorpay_order_id: "order_rzp4",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "bad_sig",
    });

    expect(await screen.findByText(/signature mismatch/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry payment/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
