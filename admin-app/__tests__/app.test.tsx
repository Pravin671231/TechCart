import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/app/App";
import { store } from "@/store/store";
import { clearAdminKey, setAdminKey } from "@/store/authSlice";

describe("App", () => {
  beforeEach(() => {
    store.dispatch(setAdminKey("test-admin-key"));
  });

  afterEach(() => {
    store.dispatch(clearAdminKey());
  });

  it("renders the placeholder landing route", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "TechCart Admin" })).toBeInTheDocument();
    expect(screen.getByText("Admin console coming soon.")).toBeInTheDocument();
  });
});
