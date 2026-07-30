import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { MRT_ColumnDef } from "material-react-table";
import { DataTable } from "@/components/DataTable";

type Row = { id: string; name: string };

const columns: MRT_ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];
const data: Row[] = [{ id: "1", name: "Sample" }];

describe("DataTable", () => {
  it("wraps the table in a locally-scrollable, width-contained section", () => {
    const { getByTestId } = render(<DataTable columns={columns} data={data} />);

    const section = getByTestId("data-table-section");
    expect(section.className).toContain("overflow-x-auto");
    expect(section.className).toContain("min-w-0");
  });
});
