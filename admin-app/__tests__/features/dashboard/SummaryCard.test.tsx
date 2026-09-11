import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShoppingBag } from "lucide-react";
import { SummaryCard } from "@/features/dashboard/SummaryCard";

describe("SummaryCard", () => {
  it("renders the label, value, and optional hint, with a decorative icon", () => {
    const { container } = render(
      <SummaryCard
        label="Total orders"
        value="128"
        icon={ShoppingBag}
        accent="primary"
        hint="in the selected range"
      />,
    );

    expect(screen.getByText("Total orders")).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("in the selected range")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("omits the hint line when no hint is given", () => {
    render(<SummaryCard label="Brands" value="6 active" icon={ShoppingBag} />);

    expect(screen.getByText("6 active")).toBeInTheDocument();
    expect(screen.queryByText(/total/)).not.toBeInTheDocument();
  });
});
