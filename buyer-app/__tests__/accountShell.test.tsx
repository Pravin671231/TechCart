import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Provider } from "react-redux";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "./mocks/server";

const API_URL = "http://localhost:4000";

const mockPush = vi.fn();
let mockPathname = "/account";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// feature/buyer-app-account-sidebar-shell — AccountShell centralizes the
// session guard previously duplicated across AccountContent/
// AddressListContent/OrderHistoryContent/OrderDetailContent, and adds the
// sidebar + mobile drawer chrome around the whole account area.
describe("AccountShell", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
    mockPush.mockClear();
    mockPathname = "/account";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function renderShell() {
    const { makeStore } = await import("@/store/store");
    const { AccountShell } = await import("@/components/layout/AccountShell");
    const store = makeStore();
    return render(
      <Provider store={store}>
        <AccountShell>
          <div data-testid="route-child">route content</div>
        </AccountShell>
      </Provider>,
    );
  }

  it("redirects to /sign-in with a redirect param when there is no session", async () => {
    server.use(
      http.get("*/api/auth/get-session", () => HttpResponse.json({ success: true, data: null })),
    );

    await renderShell();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sign-in?redirect=%2Faccount");
    });
  });

  it("renders the sidebar nav and the route content once signed in", async () => {
    server.use(
      http.get("*/api/auth/get-session", () =>
        HttpResponse.json({
          success: true,
          data: { user: { id: "u1", name: "Jane Buyer", email: "jane@example.com", role: "buyer" } },
        }),
      ),
    );

    await renderShell();

    expect(await screen.findByTestId("route-child")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Overview" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Orders" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Addresses" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Profile" }).length).toBeGreaterThan(0);
  });

  it("opens and closes the mobile drawer", async () => {
    server.use(
      http.get("*/api/auth/get-session", () =>
        HttpResponse.json({
          success: true,
          data: { user: { id: "u1", name: "Jane Buyer", email: "jane@example.com", role: "buyer" } },
        }),
      ),
    );

    await renderShell();
    await screen.findByTestId("route-child");

    const openButton = screen.getByRole("button", { name: /open account menu/i });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);
    expect(openButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: /close account menu/i }));
    expect(openButton).toHaveAttribute("aria-expanded", "false");
  });
});
