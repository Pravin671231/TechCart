import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("Account profile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockSignedInSession() {
    server.use(
      http.get("*/api/auth/get-session", () => {
        return HttpResponse.json({
          success: true,
          data: {
            user: { id: "user1", name: "Jane Buyer", email: "jane@example.com", role: "buyer" },
          },
        });
      })
    );
  }

  it("redirects to /sign-in when there is no session", async () => {
    server.use(
      http.get("*/api/auth/get-session", () => {
        return HttpResponse.json({ success: true, data: { user: null } });
      })
    );

    const { makeStore } = await import("@/store/store");
    const { AccountContent } = await import("@/features/account/AccountContent");
    const store = makeStore();

    render(
      <Provider store={store}>
        <AccountContent />
      </Provider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in");
    });
  });

  it("shows the signed-in buyer's profile", async () => {
    mockSignedInSession();
    server.use(
      http.get("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: { _id: "user1", name: "Jane Buyer", email: "jane@example.com", phone: "+919876543210" },
        });
      })
    );

    const { makeStore } = await import("@/store/store");
    const { AccountContent } = await import("@/features/account/AccountContent");
    const store = makeStore();

    render(
      <Provider store={store}>
        <AccountContent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Jane Buyer")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("jane@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+919876543210")).toBeInTheDocument();
  });

  it("updates the name and shows a confirmation, re-rendering from the mutation response", async () => {
    mockSignedInSession();
    server.use(
      http.get("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: { _id: "user1", name: "Jane Buyer", email: "jane@example.com" },
        });
      }),
      http.patch("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: { _id: "user1", name: "Jane B. Updated", email: "jane@example.com" },
        });
      })
    );

    const { makeStore } = await import("@/store/store");
    const { AccountContent } = await import("@/features/account/AccountContent");
    const store = makeStore();

    render(
      <Provider store={store}>
        <AccountContent />
      </Provider>
    );

    const nameInput = await screen.findByDisplayValue("Jane Buyer");
    fireEvent.change(nameInput, { target: { value: "Jane B. Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Jane B. Updated")).toBeInTheDocument();
  });

  it("shows a validation error and no confirmation when the update is rejected", async () => {
    mockSignedInSession();
    server.use(
      http.get("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: { _id: "user1", name: "Jane Buyer", email: "jane@example.com" },
        });
      }),
      http.patch("*/api/account/profile", () => {
        return HttpResponse.json(
          {
            success: false,
            code: "VALIDATION_ERROR",
            errors: { name: "Too small: expected string to have >=1 characters" },
          },
          { status: 400 }
        );
      })
    );

    const { makeStore } = await import("@/store/store");
    const { AccountContent } = await import("@/features/account/AccountContent");
    const store = makeStore();

    render(
      <Provider store={store}>
        <AccountContent />
      </Provider>
    );

    const nameInput = await screen.findByDisplayValue("Jane Buyer");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/too small/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/profile updated/i)).not.toBeInTheDocument();
  });
});
