import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

let mockPathname = "/account";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("AccountSidebarNav active state", () => {
  async function renderNav(pathname: string) {
    mockPathname = pathname;
    const { AccountSidebarNav } = await import("@/components/layout/AccountSidebarNav");
    render(<AccountSidebarNav />);
  }

  it("marks Overview active only on an exact /account match", async () => {
    await renderNav("/account");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Addresses" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark Overview active on /account/addresses", async () => {
    await renderNav("/account/addresses");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Addresses" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Orders active on a nested order-detail path", async () => {
    await renderNav("/orders/123");
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Profile active only on /account/profile", async () => {
    await renderNav("/account/profile");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
});
