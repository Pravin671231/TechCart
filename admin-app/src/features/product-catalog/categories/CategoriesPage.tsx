import { useEffect, useState } from "react";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusSelect } from "@/components/StatusSelect";
import {
  mockCategories,
  type Category,
  type CategoryStatus,
} from "@/features/product-catalog/categories/mockCategories";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const centerAlign = {
  muiTableHeadCellProps: { align: "center" as const },
  muiTableBodyCellProps: { align: "center" as const },
};

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  function handleStatusChange(id: string, status: string) {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === id ? { ...category, status: status as CategoryStatus } : category,
      ),
    );
  }

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
      ...centerAlign,
      Cell: ({ cell }) => cell.getValue<string | null>() ?? <span className="text-neutral-400">—</span>,
    },
    { accessorKey: "productCount", header: "Products", ...centerAlign },
    { accessorKey: "sortOrder", header: "Sort", ...centerAlign },
    {
      accessorKey: "status",
      header: "Status",
      ...centerAlign,
      filterVariant: "select",
      filterSelectOptions: statusOptions,
      Cell: ({ row }) => (
        <StatusSelect
          value={row.original.status}
          onChange={(value) => handleStatusChange(row.original.id, value)}
          options={statusOptions}
        />
      ),
    },
  ];

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

      <DataTable columns={columns} data={categories} isLoading={isLoading} />
    </div>
  );
}
