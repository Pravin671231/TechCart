import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

describe("Footer (Issue #322)", () => {
  it("renders social links as accessible icons", () => {
    render(<Footer />);
    for (const label of ["Facebook", "Instagram", "X", "YouTube"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("renders payment methods as accessible marks", () => {
    render(<Footer />);
    for (const label of ["Visa", "Mastercard", "RuPay", "UPI"]) {
      expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
    }
  });
});
