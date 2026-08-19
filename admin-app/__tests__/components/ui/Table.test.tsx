import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyRow, Table, TableHeadRow } from "@/components/ui/Table";

describe("Table", () => {
  it("renders a plain, non-fillHeight table by default", () => {
    render(
      <Table>
        <TableHeadRow>
          <th>Name</th>
        </TableHeadRow>
        <tbody>
          <EmptyRow colSpan={1} message="No rows" />
        </tbody>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("applies fillHeight classes to the outer wrapper and inner scroll region", () => {
    const { container } = render(
      <Table fillHeight>
        <TableHeadRow>
          <th>Name</th>
        </TableHeadRow>
        <tbody />
      </Table>,
    );
    const outer = container.firstElementChild as HTMLElement;
    expect(outer).toHaveClass("flex", "h-full", "min-h-0", "flex-col");

    const scrollRegion = outer.firstElementChild as HTMLElement;
    expect(scrollRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });

  it("shows the isFetching indicator and dims the table", () => {
    render(
      <Table isFetching>
        <TableHeadRow>
          <th>Name</th>
        </TableHeadRow>
        <tbody />
      </Table>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Updating…");
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });
});

describe("TableHeadRow", () => {
  it("adds sticky positioning and a solid background when sticky is set (plain variant)", () => {
    render(
      <table>
        <TableHeadRow sticky>
          <th>Name</th>
        </TableHeadRow>
      </table>,
    );
    const thead = screen.getByRole("columnheader").closest("thead") as HTMLElement;
    expect(thead).toHaveClass("sticky", "top-0", "bg-white");
  });

  it("adds sticky positioning to the shaded variant while keeping its own background", () => {
    render(
      <table>
        <TableHeadRow variant="shaded" sticky>
          <th>Name</th>
        </TableHeadRow>
      </table>,
    );
    const thead = screen.getByRole("columnheader").closest("thead") as HTMLElement;
    expect(thead).toHaveClass("sticky", "top-0", "bg-neutral-50");
  });

  it("has no sticky classes by default", () => {
    render(
      <table>
        <TableHeadRow>
          <th>Name</th>
        </TableHeadRow>
      </table>,
    );
    const thead = screen.getByRole("columnheader").closest("thead") as HTMLElement;
    expect(thead).not.toHaveClass("sticky");
  });
});
