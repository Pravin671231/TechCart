import { useState } from "react";
import { Link } from "react-router";
import { ProductList } from "./ProductList";
import type { ProductStatus } from "./types";

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus | "">("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: ProductStatus | "") {
    setStatus(value);
    setPage(1);
  }

  function handleLowStockOnlyChange(value: boolean) {
    setLowStockOnly(value);
    setPage(1);
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <Link
          to="/products/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + New product
        </Link>
      </div>

      <ProductList
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        lowStockOnly={lowStockOnly}
        onLowStockOnlyChange={handleLowStockOnlyChange}
        page={page}
        onPageChange={setPage}
      />
    </main>
  );
}
