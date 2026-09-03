import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceRangeInput } from "@/components/ui/PriceRangeInput";

describe("PriceRangeInput", () => {
  it("renders plain Min/Max number inputs when no bounds are supplied", async () => {
    const onCommit = vi.fn();
    render(<PriceRangeInput minPrice={undefined} maxPrice={undefined} onCommit={onCommit} />);

    const min = screen.getByLabelText("Minimum price");
    expect(min).toHaveAttribute("type", "number");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();

    await userEvent.type(min, "500");
    fireEvent.blur(min);
    expect(onCommit).toHaveBeenCalledWith(500, undefined);
  });

  it("renders two sliders when both bounds are supplied", () => {
    render(
      <PriceRangeInput
        minPrice={undefined}
        maxPrice={undefined}
        minBound={1000}
        maxBound={100000}
        onCommit={vi.fn()}
      />,
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveAttribute("aria-label", "Minimum price");
    expect(sliders[1]).toHaveAttribute("aria-label", "Maximum price");
  });

  it("commits dragged values on release, dropping a handle that is back at its bound", () => {
    const onCommit = vi.fn();
    render(
      <PriceRangeInput
        minPrice={undefined}
        maxPrice={undefined}
        minBound={0}
        maxBound={100}
        onCommit={onCommit}
      />,
    );

    const [minSlider, maxSlider] = screen.getAllByRole("slider");

    fireEvent.change(maxSlider, { target: { value: "60" } });
    fireEvent.blur(maxSlider);
    // min handle still at its bound → undefined
    expect(onCommit).toHaveBeenLastCalledWith(undefined, 60);

    fireEvent.change(minSlider, { target: { value: "20" } });
    fireEvent.blur(minSlider);
    expect(onCommit).toHaveBeenLastCalledWith(20, 60);
  });

  it("formats the value bubbles with the supplied formatter", () => {
    render(
      <PriceRangeInput
        minPrice={25}
        maxPrice={75}
        minBound={0}
        maxBound={100}
        formatValue={(value) => `₹${value}`}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByText("₹25")).toBeInTheDocument();
    expect(screen.getByText("₹75")).toBeInTheDocument();
  });

  it("merges the two bubbles into one when the handles are close", () => {
    render(
      <PriceRangeInput
        minPrice={48}
        maxPrice={54}
        minBound={0}
        maxBound={100}
        formatValue={(value) => `₹${value}`}
        onCommit={vi.fn()}
      />,
    );

    expect(screen.getByText(/₹48.*₹54/)).toBeInTheDocument();
    expect(screen.queryByText("₹48", { exact: true })).not.toBeInTheDocument();
  });
});
