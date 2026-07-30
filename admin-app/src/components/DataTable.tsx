import {
  MaterialReactTable,
  MRT_ToggleFullScreenButton,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_RowData,
} from "material-react-table";
import { ThemeProvider } from "@mui/material/styles";
import { muiTheme } from "@/components/muiTheme";

type DataTableProps<T extends MRT_RowData> = {
  columns: MRT_ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
};

export function DataTable<T extends MRT_RowData>({
  columns,
  data,
  isLoading = false,
}: DataTableProps<T>) {
  const table = useMaterialReactTable({
    columns,
    data,
    state: { isLoading, showProgressBars: isLoading },
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnActions: false,
    enableStickyHeader: true,
    muiTableContainerProps: {
      sx: { maxHeight: "600px" },
    },
    // Only the fullscreen button remains — omits MRT's default "Show/Hide columns" button.
    renderToolbarInternalActions: ({ table }) => <MRT_ToggleFullScreenButton table={table} />,
    muiTablePaperProps: {
      elevation: 0,
      sx: { border: "none", boxShadow: "none" },
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <section
        data-testid="data-table-section"
        className="min-w-0 overflow-x-auto rounded-lg border border-neutral-200"
      >
        <MaterialReactTable table={table} />
      </section>
    </ThemeProvider>
  );
}
