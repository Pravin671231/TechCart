import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "@/app/App";

describe("AdminShell", () => {
  it("renders the sidebar, header, and routed content", () => {
    render(<App />);

    const sidebar = screen.getByRole("complementary");
    expect(sidebar).toHaveTextContent("TechCart");
    expect(sidebar).toHaveTextContent("Product Catalog");

    const header = screen.getByRole("banner");
    expect(header).toHaveTextContent("Admin");
    expect(header.querySelector('input[type="search"]')).toBeInTheDocument();

    expect(
      screen.getByRole("main").querySelector("h1"),
    ).toHaveTextContent("Dashboard");
  });

  it("toggles the mobile sidebar drawer via the header's menu button, backdrop click, close button, and Escape", () => {
    render(<App />);

    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    expect(screen.getByTestId("sidebar-backdrop")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sidebar-backdrop"));
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle menu" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
  });
});
