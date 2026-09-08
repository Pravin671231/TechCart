import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";

const API_URL = "http://localhost:4000";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

async function renderShell(pathname: string) {
  mockPathname = pathname;
  const { makeStore } = await import("@/store/store");
  const { AppShell } = await import("@/components/layout/AppShell");
  render(
    <Provider store={makeStore()}>
      <AppShell>
        <div data-testid="route-child">route content</div>
      </AppShell>
    </Provider>,
  );
}

describe("AppShell chrome opt-out (Issue #344)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the header and footer on a normal route", async () => {
    await renderShell("/");

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByTestId("route-child")).toBeInTheDocument();
  });

  it("drops the header and footer on /sign-in, keeping the route content", async () => {
    await renderShell("/sign-in");

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-child")).toBeInTheDocument();
  });
});
