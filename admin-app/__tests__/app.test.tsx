import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/app/App";

describe("App", () => {
  it("renders the placeholder landing route", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "TechCart Admin" })).toBeInTheDocument();
    expect(screen.getByText("Admin console coming soon.")).toBeInTheDocument();
  });
});
