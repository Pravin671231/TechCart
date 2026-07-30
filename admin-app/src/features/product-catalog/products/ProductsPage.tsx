import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { FilterDropdown } from "@/components/FilterDropdown";
import { Pagination } from "@/components/Pagination";
import { mockProducts, type Product, type ProductStatus } from "@/features/product-catalog/products/mockProducts";

const PAGE_SIZE = 3;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const statusTones: Record<ProductStatus, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "warning",
  archived: "neutral",
};

const statusLabels: Record<ProductStatus, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

const statusFilterOptions = [
  { label: "All", value: "all" },
  { label: "Published", value: "published" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

const columns: ColumnDef<Product>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "sku",
    header: "SKU",
    cell: (info) => <span className="font-mono text-xs">{info.getValue<string>()}</span>,
  },
  { accessorKey: "brand", header: "Brand" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "sellingPrice",
    header: "Price",
    cell: (info) => (
      <span className="block text-right">{currency.format(info.getValue<number>())}</span>
    ),
  },
  {
    accessorKey: "stock",
    header: "Stock",
    cell: (info) => {
      const product = info.row.original;
      const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
      return (
        <span className="flex items-center justify-end gap-2">
          {product.stock}
          {isLowStock && <StatusBadge label="Low" tone="warning" />}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: (info) => {
      const status = info.getValue<ProductStatus>();
      return <StatusBadge label={statusLabels[status]} tone={statusTones[status]} />;
    },
  },
];

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = mockProducts.filter((product) => {
    const matchesSearch =
      search.trim() === "" ||
      product.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      product.sku.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === "all" || product.status === status;
    const matchesLowStock =
      !lowStockOnly || (product.stock > 0 && product.stock <= product.lowStockThreshold);
    return matchesSearch && matchesStatus && matchesLowStock;
  });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Products"
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Product Catalog" },
        ]}
        action={{ label: "Add Product", icon: LuPlus }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            resetToFirstPage();
          }}
          placeholder="Search name or SKU..."
        />
        <FilterDropdown
          label="Status"
          value={status}
          options={statusFilterOptions}
          onChange={(value) => {
            setStatus(value);
            resetToFirstPage();
          }}
        />
        <label className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(event) => {
              setLowStockOnly(event.target.checked);
              resetToFirstPage();
            }}
          />
          Low stock only
        </label>
      </div>

      <DataTable columns={columns} data={paginated} numericColumnIds={["sellingPrice", "stock"]} />

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
    </div>
  );
}
