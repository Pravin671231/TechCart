import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBreakdown } from "@/features/dashboard/StatusBreakdown";

describe("StatusBreakdown", () => {
  it("renders each segment's label, count, and share of the total", () => {
    render(
      <StatusBreakdown
        title="Orders by status"
        total={20}
        segments={[
          { label: "Paid", value: 15, tone: "success" },
          { label: "Pending payment", value: 5, tone: "neutral" },
        ]}
      />,
    );

    expect(screen.getByText("Orders by status")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Pending payment")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("shows 0% instead of NaN when the total is zero", () => {
    render(
      <StatusBreakdown
        title="Products by status"
        total={0}
        segments={[{ label: "Draft", value: 0, tone: "neutral" }]}
      />,
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
  });
});
