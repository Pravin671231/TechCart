import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "@/app/App";

describe("admin-app routing", () => {
  it.each([
    ["Products", "Products"],
    ["Categories", "Categories"],
    ["Brands", "Brands"],
    ["Specifications", "Specifications"],
    ["Variant Types", "Variant Types"],
  ])("navigates to %s from the sidebar", (linkName, heading) => {
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: linkName }));
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });
});
