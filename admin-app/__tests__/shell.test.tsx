import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
