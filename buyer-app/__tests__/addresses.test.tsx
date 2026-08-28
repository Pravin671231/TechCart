import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { server } from "./mocks/server";
import type { Address } from "@/features/addresses/types";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/account/addresses",
  useSearchParams: () => new URLSearchParams(),
}));

function address(overrides: Partial<Address> = {}): Address {
  return {
    _id: "a1",
    fullName: "Asha Rao",
    phone: "9876543210",
    line1: "221B, Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560025",
    isDefault: true,
    ...overrides,
  };
}

function signedIn() {
  server.use(
    http.get("*/api/auth/get-session", () =>
      HttpResponse.json({
        success: true,
        data: { user: { id: "u1", name: "Asha", email: "asha@example.com", role: "buyer" } },
      }),
    ),
  );
}

async function renderAddresses() {
  const { makeStore } = await import("@/store/store");
  const { AddressListContent } = await import("@/features/addresses/AddressListContent");
  render(
    <Provider store={makeStore()}>
      <AddressListContent />
    </Provider>,
  );
}

describe("Address book", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects an unauthenticated visitor to sign-in with a redirect back", async () => {
    await renderAddresses();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=/account/addresses");
    });
  });

  it("shows an empty state with an add action", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/addresses`, () => HttpResponse.json({ success: true, data: [] })),
    );

    await renderAddresses();

    expect(await screen.findByText(/no saved addresses yet/i)).toBeInTheDocument();
  });

  it("renders the saved address list", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: [address()] }),
      ),
    );

    await renderAddresses();

    expect(await screen.findByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText(/221B, Residency Road/)).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("adds a new address and shows it in the list", async () => {
    signedIn();
    let addresses: Address[] = [];
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: addresses }),
      ),
      http.post(`${API_URL}/api/addresses`, async ({ request }) => {
        const body = (await request.json()) as Omit<Address, "_id" | "isDefault">;
        const created = { ...body, _id: "new-1", isDefault: false };
        addresses = [created];
        return HttpResponse.json({ success: true, data: created }, { status: 201 });
      }),
    );

    await renderAddresses();
    await screen.findByText(/no saved addresses yet/i);

    await userEvent.click(screen.getByRole("button", { name: /add an address/i }));

    await userEvent.type(screen.getByLabelText(/full name/i), "New Buyer");
    await userEvent.type(screen.getByLabelText(/phone/i), "9123456780");
    await userEvent.type(screen.getByLabelText(/address line 1/i), "12 MG Road");
    await userEvent.type(screen.getByLabelText(/city/i), "Pune");
    await userEvent.type(screen.getByLabelText(/state/i), "Maharashtra");
    await userEvent.type(screen.getByLabelText(/pin code/i), "411001");

    await userEvent.click(screen.getByRole("button", { name: /^add address$/i }));

    await waitFor(() => {
      expect(screen.getByText("New Buyer")).toBeInTheDocument();
    });
  });

  it("edits an address", async () => {
    signedIn();
    let current = address();
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: [current] }),
      ),
      http.patch(`${API_URL}/api/addresses/a1`, async ({ request }) => {
        const body = (await request.json()) as Partial<Address>;
        current = { ...current, ...body };
        return HttpResponse.json({ success: true, data: current });
      }),
    );

    await renderAddresses();
    await screen.findByText("Asha Rao");

    await userEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const nameInput = screen.getByLabelText(/full name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Asha R. Updated");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Asha R. Updated")).toBeInTheDocument();
    });
  });

  it("deletes an address", async () => {
    signedIn();
    let addresses = [address()];
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: addresses }),
      ),
      http.delete(`${API_URL}/api/addresses/a1`, () => {
        addresses = [];
        return HttpResponse.json({ success: true, data: null });
      }),
    );

    await renderAddresses();
    await screen.findByText("Asha Rao");

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(screen.getByText(/no saved addresses yet/i)).toBeInTheDocument();
    });
  });

  it("sets a non-default address as the default", async () => {
    signedIn();
    let addresses = [
      address({ _id: "a1", fullName: "Asha Rao", isDefault: true }),
      address({ _id: "a2", fullName: "Backup Address", isDefault: false }),
    ];
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json({ success: true, data: addresses }),
      ),
      http.patch(`${API_URL}/api/addresses/a2/default`, () => {
        addresses = addresses.map((a) => ({ ...a, isDefault: a._id === "a2" }));
        return HttpResponse.json({
          success: true,
          data: addresses.find((a) => a._id === "a2"),
        });
      }),
    );

    await renderAddresses();
    await screen.findByText("Backup Address");

    await userEvent.click(screen.getByRole("button", { name: /set as default/i }));

    await waitFor(() => {
      const defaultBadges = screen.getAllByText("Default");
      expect(defaultBadges).toHaveLength(1);
    });
  });

  it("shows an error state with retry when the list request fails", async () => {
    signedIn();
    server.use(
      http.get(`${API_URL}/api/addresses`, () =>
        HttpResponse.json(
          { success: false, code: "SERVER_ERROR", message: "boom" },
          { status: 500 },
        ),
      ),
    );

    await renderAddresses();
    expect(await screen.findByText(/went wrong loading your addresses/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
