import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/app/App";

describe("AdminShell", () => {
  it("renders the sidebar, header, and routed content", () => {
    render(<App />);
    expect(screen.getByRole("complementary")).toHaveTextContent("Sidebar");
    expect(screen.getByRole("banner")).toHaveTextContent("Header");
    expect(
      screen.getByRole("main").querySelector("h1"),
    ).toHaveTextContent("TechCart Admin");
  });
});
