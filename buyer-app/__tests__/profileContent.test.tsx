import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

describe("Profile editing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function renderProfileContent() {
    const { makeStore } = await import("@/store/store");
    const { ProfileContent } = await import("@/features/authentication/account/ProfileContent");
    const store = makeStore();

    return render(
      <Provider store={store}>
        <ProfileContent />
      </Provider>,
    );
  }

  it("shows the signed-in buyer's profile", async () => {
    server.use(
      http.get("*/api/account/profile", () => {
        return HttpResponse.json({
          success: true,
          data: {
            _id: "user1",
            name: "Jane Buyer",
            email: "jane@example.com",
            phone: "+919876543210",
          },
        });
      }),
    );

    await renderProfileContent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Jane Buyer")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("jane@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+919876543210")).toBeInTheDocument();
  });

  it("updates the name and shows a confirmation, re-rendering from the mutation response", async () => {
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
      }),
    );

    await renderProfileContent();

    const nameInput = await screen.findByDisplayValue("Jane Buyer");
    fireEvent.change(nameInput, { target: { value: "Jane B. Updated" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Jane B. Updated")).toBeInTheDocument();
  });

  it("shows a validation error and no confirmation when the update is rejected", async () => {
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
          { status: 400 },
        );
      }),
    );

    await renderProfileContent();

    const nameInput = await screen.findByDisplayValue("Jane Buyer");
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/too small/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/profile updated/i)).not.toBeInTheDocument();
  });
});
