import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AlertModal } from "@/components/ui/AlertModal";

describe("AlertModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <AlertModal
        open={false}
        title="Delete brand"
        message="Delete this?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to the 'deleted' variant with a red border and 'Delete' confirm label", () => {
    render(
      <AlertModal
        open
        title="Delete brand"
        message={`Delete "Acme"? This can't be undone.`}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveClass("border-red-200");
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("applies the amber 'warning' variant styling and default 'Continue' label", () => {
    render(
      <AlertModal
        open
        variant="warning"
        title="Low stock warning"
        message="Stock will drop below threshold. Continue?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveClass("border-amber-200");
    expect(within(dialog).getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("applies the green 'confirm' variant styling and default 'Confirm' label", () => {
    render(
      <AlertModal
        open
        variant="confirm"
        title="Publish product"
        message="This makes the product visible to buyers."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveClass("border-green-200");
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onCancel when the close (X) icon is clicked", () => {
    const onCancel = vi.fn();
    render(
      <AlertModal open title="Delete brand" message="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when the overlay is clicked", () => {
    const onCancel = vi.fn();
    render(
      <AlertModal open title="Delete brand" message="Delete?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    const dialog = screen.getByRole("alertdialog");
    const overlay = screen
      .getAllByRole("button", { name: "Cancel" })
      .find((button) => !dialog.contains(button));
    fireEvent.click(overlay!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <AlertModal open title="Delete brand" message="Delete?" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows the loading label and disables Cancel while isConfirming", () => {
    render(
      <AlertModal
        open
        title="Delete brand"
        message="Delete?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isConfirming
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
