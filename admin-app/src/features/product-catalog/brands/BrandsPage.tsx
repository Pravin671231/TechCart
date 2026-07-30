import { useEffect, useState } from "react";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { mockBrands, type Brand } from "@/features/product-catalog/brands/mockBrands";

const columns: MRT_ColumnDef<Brand>[] = [
  {
    id: "logo",
    header: "Logo",
    enableSorting: false,
    enableColumnFilter: false,
    Cell: () => <span className="block h-8 w-16 rounded bg-neutral-100" />,
  },
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "productCount",
    header: "Products",
    muiTableHeadCellProps: { align: "right" },
    muiTableBodyCellProps: { align: "right" },
  },
  {
    accessorKey: "status",
    header: "Status",
    filterVariant: "select",
    filterSelectOptions: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
    ],
    Cell: ({ cell }) => {
      const status = cell.getValue<Brand["status"]>();
      return (
        <StatusBadge
          label={status === "active" ? "Active" : "Inactive"}
          tone={status === "active" ? "success" : "neutral"}
        />
      );
    },
  },
];

export function BrandsPage() {
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Brands"
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Product Catalog" },
        ]}
        action={{ label: "Add Brand", icon: LuPlus }}
      />

      <DataTable columns={columns} data={mockBrands} isLoading={isLoading} />
    </div>
  );
}
