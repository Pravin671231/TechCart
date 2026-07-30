import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { mockBrands, type Brand } from "@/features/product-catalog/brands/mockBrands";

const columns: ColumnDef<Brand>[] = [
  {
    id: "logo",
    header: "Logo",
    cell: () => <span className="block h-8 w-16 rounded bg-neutral-100" />,
  },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "productCount", header: "Products" },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const status = info.getValue<Brand["status"]>();
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
  const [search, setSearch] = useState("");

  const filtered = mockBrands.filter(
    (brand) => search.trim() === "" || brand.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

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

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." />
      </div>

      <DataTable columns={columns} data={filtered} numericColumnIds={["productCount"]} />
    </div>
  );
}
