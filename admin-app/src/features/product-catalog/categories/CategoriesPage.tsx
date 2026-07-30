import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { mockCategories, type Category } from "@/features/product-catalog/categories/mockCategories";

const columns: ColumnDef<Category>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: (info) => {
      const category = info.row.original;
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
    cell: (info) => info.getValue<string | null>() ?? <span className="text-neutral-400">—</span>,
  },
  { accessorKey: "productCount", header: "Products" },
  { accessorKey: "sortOrder", header: "Sort" },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const status = info.getValue<Category["status"]>();
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
  const [search, setSearch] = useState("");

  const filtered = mockCategories.filter(
    (category) =>
      search.trim() === "" || category.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

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

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." />
      </div>

      <DataTable columns={columns} data={filtered} numericColumnIds={["productCount", "sortOrder"]} />
    </div>
  );
}
