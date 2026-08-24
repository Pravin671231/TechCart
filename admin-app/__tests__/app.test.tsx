import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("renders the placeholder landing route once signed in", async () => {
    render(<App />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "TechCart Admin" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin console coming soon.")).toBeInTheDocument();
  });
});
