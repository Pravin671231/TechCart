import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/app/App";

describe("App", () => {
  it("renders the dashboard at the root route", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Total Products")).toBeInTheDocument();
  });
});
