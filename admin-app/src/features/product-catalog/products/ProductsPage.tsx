import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { MRT_ColumnDef } from "material-react-table";
import { LuPlus } from "react-icons/lu";
import { PageHeader } from "@/layout/PageHeader";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect } from "@/components/StatusSelect";
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

const statusOptions = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const centerAlign = {
  muiTableHeadCellProps: { align: "center" as const },
  muiTableBodyCellProps: { align: "center" as const },
};

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  // Simulates the future TanStack Query fetch latency until a real list endpoint is wired.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

  function handleStatusChange(id: string, status: string) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id ? { ...product, status: status as ProductStatus } : product,
      ),
    );
  }

  const columns: MRT_ColumnDef<Product>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "sku",
      header: "SKU",
      ...centerAlign,
      Cell: ({ cell }) => <span className="font-mono text-xs">{cell.getValue<string>()}</span>,
    },
    { accessorKey: "brand", header: "Brand", ...centerAlign },
    { accessorKey: "category", header: "Category", ...centerAlign },
    {
      accessorKey: "sellingPrice",
      header: "Price",
      ...centerAlign,
      Cell: ({ cell }) => currency.format(cell.getValue<number>()),
    },
    {
      accessorKey: "stock",
      header: "Stock",
      ...centerAlign,
      Cell: ({ row }) => {
        const product = row.original;
        const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
        return (
          <span className="flex items-center justify-center gap-2">
            {product.stock}
            {isLowStock && <StatusBadge label="Low" tone="warning" />}
          </span>
        );
      },
    },
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

  const data = lowStockOnly
    ? products.filter((product) => product.stock > 0 && product.stock <= product.lowStockThreshold)
    : products;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Products"
        breadcrumbs={[
          { label: "Home", to: "/" },
          { label: "Product Catalog" },
        ]}
        action={{
          label: "Add Product",
          icon: LuPlus,
          onClick: () => navigate("/product-catalog/products/new"),
        }}
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
