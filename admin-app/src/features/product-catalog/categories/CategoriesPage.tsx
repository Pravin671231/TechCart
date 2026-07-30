import { useEffect, useState } from "react";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { rightAlignedHeadCellProps } from "@/components/tableCellProps";
import { StatusBadge } from "@/components/StatusBadge";
import { mockCategories, type Category } from "@/features/product-catalog/categories/mockCategories";

const columns: MRT_ColumnDef<Category>[] = [
  {
    accessorKey: "name",
    header: "Name",
    Cell: ({ row }) => {
      const category = row.original;
      return category.parent ? (
        <span className="pl-6">↳ {category.name}</span>
      ) : (
        <span>{category.name}</span>
      );
    },
  },
  {
    accessorKey: "parent",
    header: "Parent",
    Cell: ({ cell }) => cell.getValue<string | null>() ?? <span className="text-neutral-400">—</span>,
  },
  {
    accessorKey: "productCount",
    header: "Products",
    muiTableHeadCellProps: rightAlignedHeadCellProps,
    muiTableBodyCellProps: { align: "right" },
  },
  {
    accessorKey: "sortOrder",
    header: "Sort",
    muiTableHeadCellProps: rightAlignedHeadCellProps,
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
      const status = cell.getValue<Category["status"]>();
      return (
        <StatusBadge
          label={status === "active" ? "Active" : "Inactive"}
          tone={status === "active" ? "success" : "neutral"}
        />
      );
    },
  },
];

export function CategoriesPage() {
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Categories"
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Product Catalog" },
        ]}
        action={{ label: "Add Category", icon: LuPlus }}
      />

      <DataTable columns={columns} data={mockCategories} isLoading={isLoading} />
    </div>
  );
}
