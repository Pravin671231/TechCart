import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SortableHeader } from "@/components/ui/SortableHeader";

type Sort = "name" | "-name";

function renderHeader(currentSort: Sort | undefined, onSortChange: (sort: Sort | undefined) => void) {
  return render(
    <table>
      <thead>
        <tr>
          <SortableHeader<Sort>
            label="Name"
            sortKeyAsc="name"
            sortKeyDesc="-name"
            currentSort={currentSort}
            onSortChange={onSortChange}
          />
        </tr>
      </thead>
    </table>,
  );
}

describe("SortableHeader", () => {
  it("goes from none to asc on click", () => {
    const onSortChange = vi.fn();
    renderHeader(undefined, onSortChange);

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith("name");
  });

  it("goes from asc to desc on click", () => {
    const onSortChange = vi.fn();
    renderHeader("name", onSortChange);

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith("-name");
  });

  it("goes from desc back to none (undefined) on click, completing the cycle", () => {
    const onSortChange = vi.fn();
    renderHeader("-name", onSortChange);

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith(undefined);
  });

  it("shows the unsorted indicator when currentSort is undefined", () => {
    renderHeader(undefined, vi.fn());
    expect(screen.getByText("⇅")).toBeInTheDocument();
  });

  it("shows the ascending indicator when currentSort matches sortKeyAsc", () => {
    renderHeader("name", vi.fn());
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("shows the descending indicator when currentSort matches sortKeyDesc", () => {
    renderHeader("-name", vi.fn());
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("keeps the accessible name as the plain label, not the indicator glyph", () => {
    renderHeader("name", vi.fn());
    expect(screen.getByRole("button", { name: "Name" })).toBeInTheDocument();
  });
});
