import { useEffect, useState } from "react";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusSelect } from "@/components/StatusSelect";
import {
  mockBrands,
  type Brand,
  type BrandStatus,
} from "@/features/product-catalog/brands/mockBrands";

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const centerAlign = {
  muiTableHeadCellProps: { align: "center" as const },
  muiTableBodyCellProps: { align: "center" as const },
};

export function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>(mockBrands);
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  function handleStatusChange(id: string, status: string) {
    setBrands((prev) =>
      prev.map((brand) => (brand.id === id ? { ...brand, status: status as BrandStatus } : brand)),
    );
  }

  const columns: MRT_ColumnDef<Brand>[] = [
    {
      id: "logo",
      header: "Logo",
      enableSorting: false,
      enableColumnFilter: false,
      ...centerAlign,
      Cell: () => <span className="mx-auto block h-8 w-16 rounded bg-neutral-100" />,
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "productCount", header: "Products", ...centerAlign },
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
        title="Brands"
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Product Catalog" },
        ]}
        action={{ label: "Add Brand", icon: LuPlus }}
      />

      <DataTable columns={columns} data={brands} isLoading={isLoading} />
    </div>
  );
}
