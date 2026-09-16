import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { Toaster } from "sonner";
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
// fires onLoad/onError from an effect (post-commit, matching a real script
// tag's own async timing) so PaymentStep's post-load effect runs without
// tripping React's "setState while rendering a different component" guard.
// `scriptBehavior` lets individual tests simulate a successful load, a script
// load failure, or a script that neither loads nor errors (a hang, covered by
// the timeout fallback) — reset to "load" in beforeEach.
let scriptBehavior: "load" | "error" | "hang" = "load";

function MockScript({ onLoad, onError }: { onLoad?: () => void; onError?: () => void }) {
  useEffect(() => {
    if (scriptBehavior === "load") onLoad?.();
    else if (scriptBehavior === "error") onError?.();
  }, [onLoad, onError]);
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
      <Toaster />
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
    scriptBehavior = "load";
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
    vi.useRealTimers();
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

  it("verifies on the widget's success callback, shows the success modal, then redirects home after 5s", async () => {
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

    vi.useFakeTimers();
    await renderPaymentStep();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(capturedOptions).toBeDefined();

    capturedOptions!.handler({
      razorpay_order_id: "order_rzp2",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "sig_1",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(mockPush).toHaveBeenCalledWith("/");
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

    // The failure reason is surfaced as a toast only now (no inline card
    // text), so a single findByText is unambiguous.
    expect(await screen.findByText(/signature mismatch/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry payment/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows a toast when initiating payment fails", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          { success: false, code: "ORDER_NOT_ELIGIBLE_FOR_PAYMENT", message: "Order already paid." },
          { status: 400 },
        ),
      ),
    );

    await renderPaymentStep();

    expect(await screen.findByText(/order already paid/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry payment/i })).toBeInTheDocument();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("recovers into the success state when initiating payment reports the order is already paid", async () => {
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          { success: false, code: "ORDER_ALREADY_PAID", message: "This order has already been paid." },
          { status: 400 },
        ),
      ),
    );

    await renderPaymentStep();

    expect(await screen.findByText(/payment successful/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry payment/i })).not.toBeInTheDocument();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("shows a toast when the Razorpay script fails to load", async () => {
    scriptBehavior = "error";

    await renderPaymentStep();

    expect(await screen.findByText(/unable to load the payment gateway/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry payment/i })).toBeInTheDocument();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("shows a toast when the Razorpay script takes too long to load", async () => {
    scriptBehavior = "hang";
    vi.useFakeTimers();

    await renderPaymentStep();

    // Advance well past SCRIPT_LOAD_TIMEOUT_MS (10s) in one go, all still
    // under fake time — the extra buffer flushes Sonner's own subsequent
    // mount/entrance tick too, so switching to real timers mid-test (which
    // would abandon anything still pending on the fake clock) isn't needed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11_000);
    });

    expect(screen.getByText(/unable to load the payment gateway/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry payment/i })).toBeInTheDocument();
  });

  it("retrying after a script-load failure re-attempts the script and completes the payment flow", async () => {
    scriptBehavior = "error";
    server.use(
      http.post(`${API_URL}/api/orders/${order.id}/payment`, () =>
        HttpResponse.json(
          {
            success: true,
            data: { razorpayOrderId: "order_rzp5", amount: 8000000, currency: "INR", keyId: "rzp_test_1" },
          },
          { status: 201 },
        ),
      ),
    );

    await renderPaymentStep();

    const retryButton = await screen.findByRole("button", { name: /retry payment/i });
    scriptBehavior = "load";
    await userEvent.click(retryButton);

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    expect(capturedOptions).toMatchObject({ order_id: "order_rzp5" });
  });
});
