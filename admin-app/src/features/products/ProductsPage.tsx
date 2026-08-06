import { useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader
        title="Products"
        actions={<LinkButton to="/products/new">+ New product</LinkButton>}
      />

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
