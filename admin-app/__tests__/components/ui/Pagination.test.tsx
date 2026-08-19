import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Pagination as PaginationData } from "@/app/api/api.types";
import { Pagination } from "@/components/ui/Pagination";

function makePagination(overrides: Partial<PaginationData> = {}): PaginationData {
  return {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5,
    hasNextPage: true,
    ...overrides,
  };
}

describe("Pagination", () => {
  it("renders nothing when there are no records", () => {
    const { container } = render(
      <Pagination
        page={1}
        pagination={makePagination({ total: 0, totalPages: 0, hasNextPage: false })}
        onPageChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the record range but hides page-number nav when there is only one page", () => {
    render(
      <Pagination
        page={1}
        pagination={makePagination({ total: 5, totalPages: 1, hasNextPage: false })}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Showing 1–5 of 5/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("marks the current page with aria-current and windows page numbers with ellipses", () => {
    render(
      <Pagination
        page={5}
        pagination={makePagination({ page: 5, total: 200, totalPages: 10, hasNextPage: true })}
        onPageChange={vi.fn()}
      />,
    );
    const current = screen.getByRole("button", { name: "5" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });

  it("disables Prev on the first page and Next when there is no next page", () => {
    render(
      <Pagination
        page={1}
        pagination={makePagination({ page: 1, totalPages: 3, hasNextPage: true })}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "‹ Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next ›" })).not.toBeDisabled();
  });

  it("calls onPageChange with the clicked page number", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        pagination={makePagination({ page: 1, totalPages: 3, hasNextPage: true })}
        onPageChange={onPageChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("hides the page-size selector when onPageSizeChange is not provided", () => {
    render(<Pagination page={1} pagination={makePagination()} onPageChange={vi.fn()} />);
    expect(screen.queryByText("Rows per page")).not.toBeInTheDocument();
  });

  it("renders the page-size selector with 10/20/50/100 options and fires onPageSizeChange", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        pagination={makePagination()}
        onPageChange={vi.fn()}
        pageSize={20}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    const select = screen.getByRole("combobox");
    expect(screen.getByRole("option", { name: "10 / page" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "20 / page" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "50 / page" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "100 / page" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
