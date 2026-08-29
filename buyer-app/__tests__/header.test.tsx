import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

const API_URL = "http://localhost:4000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

async function renderHeader() {
  const { makeStore } = await import("@/store/store");
  const { Header } = await import("@/components/layout/Header");
  render(
    <Provider store={makeStore()}>
      <Header />
    </Provider>,
  );
}

describe("Header responsiveness (Issue #324)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("toggles the mobile search panel from the collapsed trigger", async () => {
    await renderHeader();

    const trigger = screen.getByRole("button", { name: /toggle search bar/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Only the (CSS-hidden) desktop search bar is mounted initially.
    expect(screen.getAllByRole("searchbox", { name: /search/i })).toHaveLength(1);

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("searchbox", { name: /search/i })).toHaveLength(2);

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("searchbox", { name: /search/i })).toHaveLength(1);
  });

  it("closes the mobile search panel on Escape", async () => {
    await renderHeader();

    const trigger = screen.getByRole("button", { name: /toggle search bar/i });
    await userEvent.click(trigger);
    expect(screen.getAllByRole("searchbox", { name: /search/i })).toHaveLength(2);

    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getAllByRole("searchbox", { name: /search/i })).toHaveLength(1);
  });
});
