import {
  MaterialReactTable,
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
    enableRowSelection: true,
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <MaterialReactTable table={table} />
    </ThemeProvider>
  );
}
