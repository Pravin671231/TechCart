import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { AdminKeyGate } from "@/features/adminKey/AdminKeyGate";
import { renderWithStore } from "../../utils/renderWithStore";

describe("AdminKeyGate", () => {
  it("shows the admin key prompt and blocks children when no key is set", () => {
    renderWithStore(
      <AdminKeyGate>
        <div>Protected content</div>
      </AdminKeyGate>,
      { adminKey: null },
    );

    expect(screen.getByRole("heading", { name: "Admin key required" })).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders children directly when an admin key is already set", () => {
    renderWithStore(
      <AdminKeyGate>
        <div>Protected content</div>
      </AdminKeyGate>,
      { adminKey: "existing-key" },
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin key required" })).not.toBeInTheDocument();
  });

  it("unblocks children after submitting the prompt", () => {
    renderWithStore(
      <AdminKeyGate>
        <div>Protected content</div>
      </AdminKeyGate>,
      { adminKey: null },
    );

    fireEvent.change(screen.getByLabelText("Admin key"), { target: { value: "my-secret-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
