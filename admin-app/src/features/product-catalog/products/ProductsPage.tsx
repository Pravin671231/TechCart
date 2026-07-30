import { useEffect, useState } from "react";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import {
  mockProducts,
  type Product,
  type ProductStatus,
} from "@/features/product-catalog/products/mockProducts";

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

const columns: MRT_ColumnDef<Product>[] = [
  { accessorKey: "name", header: "Name" },
  {
    accessorKey: "sku",
    header: "SKU",
    Cell: ({ cell }) => <span className="font-mono text-xs">{cell.getValue<string>()}</span>,
  },
  { accessorKey: "brand", header: "Brand" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "sellingPrice",
    header: "Price",
    muiTableHeadCellProps: { align: "right" },
    muiTableBodyCellProps: { align: "right" },
    Cell: ({ cell }) => currency.format(cell.getValue<number>()),
  },
  {
    accessorKey: "stock",
    header: "Stock",
    muiTableHeadCellProps: { align: "right" },
    muiTableBodyCellProps: { align: "right" },
    Cell: ({ row }) => {
      const product = row.original;
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
    filterVariant: "select",
    filterSelectOptions: [
      { value: "published", label: "Published" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ],
    Cell: ({ cell }) => {
      const status = cell.getValue<ProductStatus>();
      return <StatusBadge label={statusLabels[status]} tone={statusTones[status]} />;
    },
  },
];

export function ProductsPage() {
  const [lowStockOnly, setLowStockOnly] = useState(false);
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  const data = lowStockOnly
    ? mockProducts.filter((product) => product.stock > 0 && product.stock <= product.lowStockThreshold)
    : mockProducts;

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

      <label className="mb-4 flex h-9 w-fit items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={lowStockOnly}
          onChange={(event) => setLowStockOnly(event.target.checked)}
        />
        Low stock only
      </label>

      <DataTable columns={columns} data={data} isLoading={isLoading} />
    </div>
  );
}
