import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the placeholder home page", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "TechCart" })).toBeInTheDocument();
    expect(screen.getByText("Storefront coming soon.")).toBeInTheDocument();
  });
});
